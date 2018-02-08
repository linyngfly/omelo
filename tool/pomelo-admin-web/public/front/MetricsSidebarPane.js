/*
 * Copyright (C) 2007 Apple Inc.  All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @extends {WebInspector.SidebarPane}
 */
WebInspector.MetricsSidebarPane = function()
{
    WebInspector.SidebarPane.call(this, WebInspector.UIString("Metrics"));

    WebInspector.cssModel.addEventListener(WebInspector.CSSStyleModel.Events.StyleSheetChanged, this._styleSheetOrMediaQueryResultChanged, this);
    WebInspector.cssModel.addEventListener(WebInspector.CSSStyleModel.Events.MediaQueryResultChanged, this._styleSheetOrMediaQueryResultChanged, this);
    WebInspector.domAgent.addEventListener(WebInspector.DOMAgent.Events.AttrModified, this._attributesUpdated, this);
    WebInspector.domAgent.addEventListener(WebInspector.DOMAgent.Events.AttrRemoved, this._attributesUpdated, this);
}

WebInspector.MetricsSidebarPane.prototype = {
    /**
     * @param {WebInspector.DOMNode=} node
     */
    update: function(node)
    {
        if (node)
            this.node = node;
        this._innerUpdate();
    },

    _innerUpdate: function()
    {
        // "style" attribute might have changed. Update metrics unless they are being edited
        // (if a CSS property is added, a StyleSheetChanged event is dispatched).
        if (this._isEditingMetrics)
            return;

        // FIXME: avoid updates of a collapsed pane.
        let node = this.node;

        if (!node || node.nodeType() !== Node.ELEMENT_NODE) {
            this.bodyElement.removeChildren();
            return;
        }

        function callback(style)
        {
            if (!style || this.node !== node)
                return;
            this._updateMetrics(style);
        }
        WebInspector.cssModel.getComputedStyleAsync(node.id, WebInspector.panels.elements.sidebarPanes.styles.forcedPseudoClasses, callback.bind(this));

        function inlineStyleCallback(style)
        {
            if (!style || this.node !== node)
                return;
            this.inlineStyle = style;
        }
        WebInspector.cssModel.getInlineStylesAsync(node.id, inlineStyleCallback.bind(this));
    },

    _styleSheetOrMediaQueryResultChanged: function()
    {
        this._innerUpdate();
    },

    _attributesUpdated: function(event)
    {
        if (this.node !== event.data.node)
            return;

        this._innerUpdate();
    },

    _getPropertyValueAsPx: function(style, propertyName)
    {
        return Number(style.getPropertyValue(propertyName).replace(/px$/, "") || 0);
    },

    _getBox: function(computedStyle, componentName)
    {
        let suffix = componentName === "border" ? "-width" : "";
        let left = this._getPropertyValueAsPx(computedStyle, componentName + "-left" + suffix);
        let top = this._getPropertyValueAsPx(computedStyle, componentName + "-top" + suffix);
        let right = this._getPropertyValueAsPx(computedStyle, componentName + "-right" + suffix);
        let bottom = this._getPropertyValueAsPx(computedStyle, componentName + "-bottom" + suffix);
        return { left: left, top: top, right: right, bottom: bottom };
    },

    _highlightDOMNode: function(showHighlight, mode, event)
    {
        event.consume();
        let nodeId = showHighlight && this.node ? this.node.id : 0;
        if (nodeId) {
            if (this._highlightMode === mode)
                return;
            this._highlightMode = mode;
            WebInspector.domAgent.highlightDOMNode(nodeId, mode);
        } else {
            delete this._highlightMode;
            WebInspector.domAgent.hideDOMNodeHighlight();
        }

        for (let i = 0; this._boxElements && i < this._boxElements.length; ++i) {
            let element = this._boxElements[i];
            if (!nodeId || mode === "all" || element._name === mode)
                element.style.backgroundColor = element._backgroundColor;
            else
                element.style.backgroundColor = "";
        }
    },

    _updateMetrics: function(style)
    {
        // Updating with computed style.
        let metricsElement = document.createElement("div");
        metricsElement.className = "metrics";
        let self = this;

        function createBoxPartElement(style, name, side, suffix)
        {
            let propertyName = (name !== "position" ? name + "-" : "") + side + suffix;
            let value = style.getPropertyValue(propertyName);
            if (value === "" || (name !== "position" && value === "0px"))
                value = "\u2012";
            else if (name === "position" && value === "auto")
                value = "\u2012";
            value = value.replace(/px$/, "");

            let element = document.createElement("div");
            element.className = side;
            element.textContent = value;
            element.addEventListener("dblclick", this.startEditing.bind(this, element, name, propertyName, style), false);
            return element;
        }

        function getContentAreaWidthPx(style)
        {
            let width = style.getPropertyValue("width").replace(/px$/, "");
            if (style.getPropertyValue("box-sizing") === "border-box") {
                let borderBox = self._getBox(style, "border");
                let paddingBox = self._getBox(style, "padding");

                width = width - borderBox.left - borderBox.right - paddingBox.left - paddingBox.right;
            }

            return width;
        }

        function getContentAreaHeightPx(style)
        {
            let height = style.getPropertyValue("height").replace(/px$/, "");
            if (style.getPropertyValue("box-sizing") === "border-box") {
                let borderBox = self._getBox(style, "border");
                let paddingBox = self._getBox(style, "padding");

                height = height - borderBox.top - borderBox.bottom - paddingBox.top - paddingBox.bottom;
            }

            return height;
        }

        // Display types for which margin is ignored.
        let noMarginDisplayType = {
            "table-cell": true,
            "table-column": true,
            "table-column-group": true,
            "table-footer-group": true,
            "table-header-group": true,
            "table-row": true,
            "table-row-group": true
        };

        // Display types for which padding is ignored.
        let noPaddingDisplayType = {
            "table-column": true,
            "table-column-group": true,
            "table-footer-group": true,
            "table-header-group": true,
            "table-row": true,
            "table-row-group": true
        };

        // Position types for which top, left, bottom and right are ignored.
        let noPositionType = {
            "static": true
        };

        let boxes = ["content", "padding", "border", "margin", "position"];
        let boxColors = [
            WebInspector.Color.PageHighlight.Content,
            WebInspector.Color.PageHighlight.Padding,
            WebInspector.Color.PageHighlight.Border,
            WebInspector.Color.PageHighlight.Margin,
            WebInspector.Color.fromRGBA(0, 0, 0, 0)
        ];
        let boxLabels = [WebInspector.UIString("content"), WebInspector.UIString("padding"), WebInspector.UIString("border"), WebInspector.UIString("margin"), WebInspector.UIString("position")];
        let previousBox = null;
        this._boxElements = [];
        for (let i = 0; i < boxes.length; ++i) {
            let name = boxes[i];

            if (name === "margin" && noMarginDisplayType[style.getPropertyValue("display")])
                continue;
            if (name === "padding" && noPaddingDisplayType[style.getPropertyValue("display")])
                continue;
            if (name === "position" && noPositionType[style.getPropertyValue("position")])
                continue;

            let boxElement = document.createElement("div");
            boxElement.className = name;
            boxElement._backgroundColor = boxColors[i].toString("original");
            boxElement._name = name;
            boxElement.style.backgroundColor = boxElement._backgroundColor;
            boxElement.addEventListener("mouseover", this._highlightDOMNode.bind(this, true, name === "position" ? "all" : name), false);
            this._boxElements.push(boxElement);

            if (name === "content") {
                let widthElement = document.createElement("span");
                widthElement.textContent = getContentAreaWidthPx(style);
                widthElement.addEventListener("dblclick", this.startEditing.bind(this, widthElement, "width", "width", style), false);

                let heightElement = document.createElement("span");
                heightElement.textContent = getContentAreaHeightPx(style);
                heightElement.addEventListener("dblclick", this.startEditing.bind(this, heightElement, "height", "height", style), false);

                boxElement.appendChild(widthElement);
                boxElement.appendChild(document.createTextNode(" \u00D7 "));
                boxElement.appendChild(heightElement);
            } else {
                let suffix = (name === "border" ? "-width" : "");

                let labelElement = document.createElement("div");
                labelElement.className = "label";
                labelElement.textContent = boxLabels[i];
                boxElement.appendChild(labelElement);

                boxElement.appendChild(createBoxPartElement.call(this, style, name, "top", suffix));
                boxElement.appendChild(document.createElement("br"));
                boxElement.appendChild(createBoxPartElement.call(this, style, name, "left", suffix));

                if (previousBox)
                    boxElement.appendChild(previousBox);

                boxElement.appendChild(createBoxPartElement.call(this, style, name, "right", suffix));
                boxElement.appendChild(document.createElement("br"));
                boxElement.appendChild(createBoxPartElement.call(this, style, name, "bottom", suffix));
            }

            previousBox = boxElement;
        }

        metricsElement.appendChild(previousBox);
        metricsElement.addEventListener("mouseover", this._highlightDOMNode.bind(this, false, ""), false);
        this.bodyElement.removeChildren();
        this.bodyElement.appendChild(metricsElement);
    },

    startEditing: function(targetElement, box, styleProperty, computedStyle)
    {
        if (WebInspector.isBeingEdited(targetElement))
            return;

        let context = { box: box, styleProperty: styleProperty, computedStyle: computedStyle };
        let boundKeyDown = this._handleKeyDown.bind(this, context, styleProperty);
        context.keyDownHandler = boundKeyDown;
        targetElement.addEventListener("keydown", boundKeyDown, false);

        this._isEditingMetrics = true;

        let config = new WebInspector.EditingConfig(this.editingCommitted.bind(this), this.editingCancelled.bind(this), context);
        WebInspector.startEditing(targetElement, config);

        window.getSelection().setBaseAndExtent(targetElement, 0, targetElement, 1);
    },

    _handleKeyDown: function(context, styleProperty, event)
    {
        if (!/^(?:Page)?(?:Up|Down)$/.test(event.keyIdentifier))
            return;
        let element = event.currentTarget;

        let selection = window.getSelection();
        if (!selection.rangeCount)
            return;

        let selectionRange = selection.getRangeAt(0);
        if (!selectionRange.commonAncestorContainer.isSelfOrDescendant(element))
            return;

        let originalValue = element.textContent;
        let wordRange = selectionRange.startContainer.rangeOfWord(selectionRange.startOffset, WebInspector.StylesSidebarPane.StyleValueDelimiters, element);
        let wordString = wordRange.toString();

        let matches = /(.*?)(-?(?:\d+(?:\.\d+)?|\.\d+))(.*)/.exec(wordString);
        let replacementString;
        if (matches && matches.length) {
            let prefix = matches[1];
            let suffix = matches[3];
            let number = WebInspector.StylesSidebarPane.alteredFloatNumber(parseFloat(matches[2]), event);
            if (number === null) {
                // Need to check for null explicitly.
                return;
            }

            if (styleProperty !== "margin" && number < 0)
                number = 0;

            replacementString = prefix + number + suffix;
        }
        if (!replacementString)
            return;

        let replacementTextNode = document.createTextNode(replacementString);

        wordRange.deleteContents();
        wordRange.insertNode(replacementTextNode);

        let finalSelectionRange = document.createRange();
        finalSelectionRange.setStart(replacementTextNode, 0);
        finalSelectionRange.setEnd(replacementTextNode, replacementString.length);

        selection.removeAllRanges();
        selection.addRange(finalSelectionRange);

        event.handled = true;
        event.preventDefault();
        this._applyUserInput(element, replacementString, originalValue, context, false);
    },

    editingEnded: function(element, context)
    {
        delete this.originalPropertyData;
        delete this.previousPropertyDataCandidate;
        element.removeEventListener("keydown", context.keyDownHandler, false);
        delete this._isEditingMetrics;
    },

    editingCancelled: function(element, context)
    {
        if ("originalPropertyData" in this && this.inlineStyle) {
            if (!this.originalPropertyData) {
                // An added property, remove the last property in the style.
                let pastLastSourcePropertyIndex = this.inlineStyle.pastLastSourcePropertyIndex();
                if (pastLastSourcePropertyIndex)
                    this.inlineStyle.allProperties[pastLastSourcePropertyIndex - 1].setText("", false);
            } else
                this.inlineStyle.allProperties[this.originalPropertyData.index].setText(this.originalPropertyData.propertyText, false);
        }
        this.editingEnded(element, context);
        this.update();
    },

    _applyUserInput: function(element, userInput, previousContent, context, commitEditor)
    {
        if (!this.inlineStyle) {
            // Element has no renderer.
            return this.editingCancelled(element, context); // nothing changed, so cancel
        }

        if (commitEditor && userInput === previousContent)
            return this.editingCancelled(element, context); // nothing changed, so cancel

        if (context.box !== "position" && (!userInput || userInput === "\u2012"))
            userInput = "0px";
        else if (context.box === "position" && (!userInput || userInput === "\u2012"))
            userInput = "auto";

        userInput = userInput.toLowerCase();
        // Append a "px" unit if the user input was just a number.
        if (/^\d+$/.test(userInput))
            userInput += "px";

        let styleProperty = context.styleProperty;
        let computedStyle = context.computedStyle;

        if (computedStyle.getPropertyValue("box-sizing") === "border-box" && (styleProperty === "width" || styleProperty === "height")) {
            if (!userInput.match(/px$/)) {
                WebInspector.log("For elements with box-sizing: border-box, only absolute content area dimensions can be applied", WebInspector.ConsoleMessage.MessageLevel.Error, true);
                return;
            }

            let borderBox = this._getBox(computedStyle, "border");
            let paddingBox = this._getBox(computedStyle, "padding");
            let userValuePx = Number(userInput.replace(/px$/, ""));
            if (isNaN(userValuePx))
                return;
            if (styleProperty === "width")
                userValuePx += borderBox.left + borderBox.right + paddingBox.left + paddingBox.right;
            else
                userValuePx += borderBox.top + borderBox.bottom + paddingBox.top + paddingBox.bottom;

            userInput = userValuePx + "px";
        }

        this.previousPropertyDataCandidate = null;
        let self = this;
        let callback = function(style) {
            if (!style)
                return;
            self.inlineStyle = style;
            if (!("originalPropertyData" in self))
                self.originalPropertyData = self.previousPropertyDataCandidate;

            if (typeof self._highlightMode !== "undefined") {
                WebInspector.domAgent.highlightDOMNode(self.node.id, self._highlightMode);
            }

            if (commitEditor) {
                self.dispatchEventToListeners("metrics edited");
                self.update();
            }
        };

        let allProperties = this.inlineStyle.allProperties;
        for (let i = 0; i < allProperties.length; ++i) {
            let property = allProperties[i];
            if (property.name !== context.styleProperty || property.inactive)
                continue;

            this.previousPropertyDataCandidate = property;
            property.setValue(userInput, commitEditor, true, callback);
            return;
        }

        this.inlineStyle.appendProperty(context.styleProperty, userInput, callback);
    },

    editingCommitted: function(element, userInput, previousContent, context)
    {
        this.editingEnded(element, context);
        this._applyUserInput(element, userInput, previousContent, context, true);
    }
}

WebInspector.MetricsSidebarPane.prototype.__proto__ = WebInspector.SidebarPane.prototype;