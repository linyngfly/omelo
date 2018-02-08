/*
 * Copyright (C) 2007 Apple Inc.  All rights reserved.
 * Copyright (C) 2009 Joseph Pecoraro
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
WebInspector.StylesSidebarPane = function(computedStylePane)
{
    WebInspector.SidebarPane.call(this, WebInspector.UIString("Styles"));

    this.settingsSelectElement = document.createElement("select");
    this.settingsSelectElement.className = "select-settings";

    let option = document.createElement("option");
    option.value = WebInspector.StylesSidebarPane.ColorFormat.Original;
    option.label = WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "As authored" : "As Authored");
    this.settingsSelectElement.appendChild(option);

    option = document.createElement("option");
    option.value = WebInspector.StylesSidebarPane.ColorFormat.HEX;
    option.label = WebInspector.UIString("Hex Colors");
    this.settingsSelectElement.appendChild(option);

    option = document.createElement("option");
    option.value = WebInspector.StylesSidebarPane.ColorFormat.RGB;
    option.label = WebInspector.UIString("RGB Colors");
    this.settingsSelectElement.appendChild(option);

    option = document.createElement("option");
    option.value = WebInspector.StylesSidebarPane.ColorFormat.HSL;
    option.label = WebInspector.UIString("HSL Colors");
    this.settingsSelectElement.appendChild(option);

    // Prevent section from collapsing.
    let muteEventListener = function(event) { event.consume(true); };

    this.settingsSelectElement.addEventListener("click", muteEventListener, true);
    this.settingsSelectElement.addEventListener("change", this._changeSetting.bind(this), false);
    this._updateColorFormatFilter();

    this.titleElement.appendChild(this.settingsSelectElement);

    this._elementStateButton = document.createElement("button");
    this._elementStateButton.className = "pane-title-button element-state";
    this._elementStateButton.title = WebInspector.UIString("Toggle Element State");
    this._elementStateButton.addEventListener("click", this._toggleElementStatePane.bind(this), false);
    this.titleElement.appendChild(this._elementStateButton);

    let addButton = document.createElement("button");
    addButton.className = "pane-title-button add";
    addButton.id = "add-style-button-test-id";
    addButton.title = WebInspector.UIString("New Style Rule");
    addButton.addEventListener("click", this._createNewRule.bind(this), false);
    this.titleElement.appendChild(addButton);

    this._computedStylePane = computedStylePane;
    computedStylePane._stylesSidebarPane = this;
    this.element.addEventListener("contextmenu", this._contextMenuEventFired.bind(this), true);
    WebInspector.settings.colorFormat.addChangeListener(this._colorFormatSettingChanged.bind(this));

    this._createElementStatePane();
    this.bodyElement.appendChild(this._elementStatePane);
    this._sectionsContainer = document.createElement("div");
    this.bodyElement.appendChild(this._sectionsContainer);

    this._spectrum = new WebInspector.Spectrum();

    WebInspector.cssModel.addEventListener(WebInspector.CSSStyleModel.Events.StyleSheetChanged, this._styleSheetOrMediaQueryResultChanged, this);
    WebInspector.cssModel.addEventListener(WebInspector.CSSStyleModel.Events.MediaQueryResultChanged, this._styleSheetOrMediaQueryResultChanged, this);
    WebInspector.domAgent.addEventListener(WebInspector.DOMAgent.Events.AttrModified, this._attributesModified, this);
    WebInspector.domAgent.addEventListener(WebInspector.DOMAgent.Events.AttrRemoved, this._attributesRemoved, this);
    WebInspector.domAgent.addEventListener(WebInspector.DOMAgent.Events.StyleInvalidated, this._styleInvalidated, this);
    WebInspector.settings.showUserAgentStyles.addChangeListener(this._showUserAgentStylesSettingChanged.bind(this));
}

WebInspector.StylesSidebarPane.ColorFormat = {
    Original: "original",
    Nickname: "nickname",
    HEX: "hex",
    ShortHEX: "shorthex",
    RGB: "rgb",
    RGBA: "rgba",
    HSL: "hsl",
    HSLA: "hsla"
}

WebInspector.StylesSidebarPane.StyleValueDelimiters = " \xA0\t\n\"':;,/()";


// Keep in sync with RenderStyleConstants.h PseudoId enum. Array below contains pseudo id names for corresponding enum indexes.
// First item is empty due to its artificial NOPSEUDO nature in the enum.
// FIXME: find a way of generating this mapping or getting it from combination of RenderStyleConstants and CSSSelector.cpp at
// runtime.
WebInspector.StylesSidebarPane.PseudoIdNames = [
    "", "first-line", "first-letter", "before", "after", "selection", "", "-webkit-scrollbar", "-webkit-file-upload-button",
    "-webkit-input-placeholder", "-webkit-slider-thumb", "-webkit-search-cancel-button", "-webkit-search-decoration",
    "-webkit-search-results-decoration", "-webkit-search-results-button", "-webkit-media-controls-panel",
    "-webkit-media-controls-play-button", "-webkit-media-controls-mute-button", "-webkit-media-controls-timeline",
    "-webkit-media-controls-timeline-container", "-webkit-media-controls-volume-slider",
    "-webkit-media-controls-volume-slider-container", "-webkit-media-controls-current-time-display",
    "-webkit-media-controls-time-remaining-display", "-webkit-media-controls-seek-back-button", "-webkit-media-controls-seek-forward-button",
    "-webkit-media-controls-fullscreen-button", "-webkit-media-controls-rewind-button", "-webkit-media-controls-return-to-realtime-button",
    "-webkit-media-controls-toggle-closed-captions-button", "-webkit-media-controls-status-display", "-webkit-scrollbar-thumb",
    "-webkit-scrollbar-button", "-webkit-scrollbar-track", "-webkit-scrollbar-track-piece", "-webkit-scrollbar-corner",
    "-webkit-resizer", "-webkit-input-list-button", "-webkit-inner-spin-button", "-webkit-outer-spin-button"
];

WebInspector.StylesSidebarPane.CSSNumberRegex = /^(-?(?:\d+(?:\.\d+)?|\.\d+))$/;

WebInspector.StylesSidebarPane.alteredFloatNumber = function(number, event)
{
    let arrowKeyPressed = (event.keyIdentifier === "Up" || event.keyIdentifier === "Down");

    // Jump by 10 when shift is down or jump by 0.1 when Alt/Option is down.
    // Also jump by 10 for page up and down, or by 100 if shift is held with a page key.
    let changeAmount = 1;
    if (event.shiftKey && !arrowKeyPressed)
        changeAmount = 100;
    else if (event.shiftKey || !arrowKeyPressed)
        changeAmount = 10;
    else if (event.altKey)
        changeAmount = 0.1;

    if (event.keyIdentifier === "Down" || event.keyIdentifier === "PageDown")
        changeAmount *= -1;

    // Make the new number and constrain it to a precision of 6, this matches numbers the engine returns.
    // Use the Number constructor to forget the fixed precision, so 1.100000 will print as 1.1.
    let result = Number((number + changeAmount).toFixed(6));
    if (!String(result).match(WebInspector.StylesSidebarPane.CSSNumberRegex))
        return null;

    return result;
}

WebInspector.StylesSidebarPane.alteredHexNumber = function(hexString, event)
{
    let number = parseInt(hexString, 16);
    if (isNaN(number) || !isFinite(number))
        return hexString;

    let maxValue = Math.pow(16, hexString.length) - 1;
    let arrowKeyPressed = (event.keyIdentifier === "Up" || event.keyIdentifier === "Down");

    let delta;
    if (arrowKeyPressed)
        delta = (event.keyIdentifier === "Up") ? 1 : -1;
    else
        delta = (event.keyIdentifier === "PageUp") ? 16 : -16;

    if (event.shiftKey)
        delta *= 16;

    let result = number + delta;
    if (result < 0)
        result = 0; // Color hex values are never negative, so clamp to 0.
    else if (result > maxValue)
        return hexString;

    // Ensure the result length is the same as the original hex value.
    let resultString = result.toString(16).toUpperCase();
    for (let i = 0, lengthDelta = hexString.length - resultString.length; i < lengthDelta; ++i)
        resultString = "0" + resultString;
    return resultString;
}

WebInspector.StylesSidebarPane.canonicalPropertyName = function(name)
{
    if (!name || name.length < 9 || name.charAt(0) !== "-")
        return name;
    let match = name.match(/(?:-webkit-|-khtml-|-apple-)(.+)/);
    if (!match)
        return name;
    return match[1];
}

WebInspector.StylesSidebarPane.prototype = {
    _contextMenuEventFired: function(event)
    {
        let contextMenu = new WebInspector.ContextMenu();
        if (WebInspector.populateHrefContextMenu(contextMenu, this.node, event))
            contextMenu.show(event);
    },

    get forcedPseudoClasses()
    {
        return this._forcedPseudoClasses;
    },

    update: function(node, forceUpdate)
    {
        if (this._spectrum.visible)
            this._spectrum.hide();

        let refresh = false;

        if (forceUpdate)
            delete this.node;

        if (!forceUpdate && (node === this.node))
            refresh = true;

        if (node && node.nodeType() === Node.TEXT_NODE && node.parentNode)
            node = node.parentNode;

        if (node && node.nodeType() !== Node.ELEMENT_NODE)
            node = null;

        if (node)
            this.node = node;
        else
            node = this.node;

        if (refresh)
            this._refreshUpdate();
        else
            this._rebuildUpdate();
    },

    /**
     * @param {WebInspector.StylePropertiesSection=} editedSection
     * @param {boolean=} forceFetchComputedStyle
     * @param {function()=} userCallback
     */
    _refreshUpdate: function(editedSection, forceFetchComputedStyle, userCallback)
    {
        if (this._refreshUpdateInProgress) {
            this._lastNodeForInnerRefresh = this.node;
            return;
        }

        let node = this._validateNode(userCallback);
        if (!node)
            return;

        function computedStyleCallback(computedStyle)
        {
            delete this._refreshUpdateInProgress;

            if (this._lastNodeForInnerRefresh) {
                delete this._lastNodeForInnerRefresh;
                this._refreshUpdate(editedSection, forceFetchComputedStyle, userCallback);
                return;
            }

            if (this.node === node && computedStyle)
                this._innerRefreshUpdate(node, computedStyle, editedSection);

            if (userCallback)
                userCallback();
        }

        if (this._computedStylePane.expanded || forceFetchComputedStyle) {
            this._refreshUpdateInProgress = true;
            WebInspector.cssModel.getComputedStyleAsync(node.id, this._forcedPseudoClasses, computedStyleCallback.bind(this));
        } else {
            this._innerRefreshUpdate(node, null, editedSection);
            if (userCallback)
                userCallback();
        }
    },

    /**
     * @param {function()=} userCallback
     */
    _rebuildUpdate: function(userCallback)
    {
        if (this._rebuildUpdateInProgress) {
            this._lastNodeForInnerRebuild = this.node;
            return;
        }

        let node = this._validateNode(userCallback);
        if (!node)
            return;

        this._rebuildUpdateInProgress = true;

        let resultStyles = {};

        function stylesCallback(matchedResult)
        {
            delete this._rebuildUpdateInProgress;

            if (this._lastNodeForInnerRebuild) {
                delete this._lastNodeForInnerRebuild;
                this._rebuildUpdate(userCallback);
                return;
            }

            if (matchedResult && this.node === node) {
                resultStyles.matchedCSSRules = matchedResult.matchedCSSRules;
                resultStyles.pseudoElements = matchedResult.pseudoElements;
                resultStyles.inherited = matchedResult.inherited;
                this._innerRebuildUpdate(node, resultStyles);
            }
            if (userCallback)
                userCallback();
        }

        function inlineCallback(inlineStyle, attributesStyle)
        {
            resultStyles.inlineStyle = inlineStyle;
            resultStyles.attributesStyle = attributesStyle;
        }

        function computedCallback(computedStyle)
        {
            resultStyles.computedStyle = computedStyle;
        }

        if (this._computedStylePane.expanded)
            WebInspector.cssModel.getComputedStyleAsync(node.id, this._forcedPseudoClasses, computedCallback.bind(this));
        WebInspector.cssModel.getInlineStylesAsync(node.id, inlineCallback.bind(this));
        WebInspector.cssModel.getMatchedStylesAsync(node.id, this._forcedPseudoClasses, true, true, stylesCallback.bind(this));
    },

    _validateNode: function(userCallback)
    {
        if (!this.node) {
            this._sectionsContainer.removeChildren();
            this._computedStylePane.bodyElement.removeChildren();
            this.sections = {};
            if (userCallback)
                userCallback();
            return null;
        }
        return this.node;
    },

    _styleSheetOrMediaQueryResultChanged: function()
    {
        if (this._userOperation || this._isEditingStyle)
            return;

        this._rebuildUpdate();
    },

    _attributesModified: function(event)
    {
        if (this.node !== event.data.node)
            return;

        // Changing style attribute will anyways generate _styleInvalidated message.
        if (event.data.name === "style")
            return;

        // "class" (or any other) attribute might have changed. Update styles unless they are being edited.
        if (!this._isEditingStyle && !this._userOperation)
            this._rebuildUpdate();
    },

    _attributesRemoved: function(event)
    {
        if (this.node !== event.data.node)
            return;

        // "style" attribute might have been removed.
        if (!this._isEditingStyle && !this._userOperation)
            this._rebuildUpdate();
    },

    _styleInvalidated: function(event)
    {
        if (this.node !== event.data)
            return;

        if (!this._isEditingStyle && !this._userOperation)
            this._rebuildUpdate();
    },

    _innerRefreshUpdate: function(node, computedStyle, editedSection)
    {
        for (let pseudoId in this.sections) {
            let styleRules = this._refreshStyleRules(this.sections[pseudoId], computedStyle);
            let usedProperties = {};
            this._markUsedProperties(styleRules, usedProperties);
            this._refreshSectionsForStyleRules(styleRules, usedProperties, editedSection);
        }
        if (computedStyle)
            this.sections[0][0].rebuildComputedTrace(this.sections[0]);

        this._nodeStylesUpdatedForTest(node, false);
    },

    _innerRebuildUpdate: function(node, styles)
    {
        this._sectionsContainer.removeChildren();
        this._computedStylePane.bodyElement.removeChildren();

        let styleRules = this._rebuildStyleRules(node, styles);
        let usedProperties = {};
        this._markUsedProperties(styleRules, usedProperties);
        this.sections[0] = this._rebuildSectionsForStyleRules(styleRules, usedProperties, 0, null);
        let anchorElement = this.sections[0].inheritedPropertiesSeparatorElement;

        if (styles.computedStyle)        
            this.sections[0][0].rebuildComputedTrace(this.sections[0]);

        for (let i = 0; i < styles.pseudoElements.length; ++i) {
            let pseudoElementCSSRules = styles.pseudoElements[i];

            styleRules = [];
            let pseudoId = pseudoElementCSSRules.pseudoId;

            let entry = { isStyleSeparator: true, pseudoId: pseudoId };
            styleRules.push(entry);

            // Add rules in reverse order to match the cascade order.
            for (let j = pseudoElementCSSRules.rules.length - 1; j >= 0; --j) {
                let rule = pseudoElementCSSRules.rules[j];
                styleRules.push({ style: rule.style, selectorText: rule.selectorText, media: rule.media, sourceURL: rule.sourceURL, rule: rule, editable: !!(rule.style && rule.style.id) });
            }
            usedProperties = {};
            this._markUsedProperties(styleRules, usedProperties);
            this.sections[pseudoId] = this._rebuildSectionsForStyleRules(styleRules, usedProperties, pseudoId, anchorElement);
        }

        this._nodeStylesUpdatedForTest(node, true);
    },

    _nodeStylesUpdatedForTest: function(node, rebuild)
    {
        // Tests override this method.
    },

    _refreshStyleRules: function(sections, computedStyle)
    {
        let nodeComputedStyle = computedStyle;
        let styleRules = [];
        for (let i = 0; sections && i < sections.length; ++i) {
            let section = sections[i];
            if (section.isBlank)
                continue;
            if (section.computedStyle)
                section.styleRule.style = nodeComputedStyle;
            let styleRule = { section: section, style: section.styleRule.style, computedStyle: section.computedStyle, rule: section.rule, editable: !!(section.styleRule.style && section.styleRule.style.id) };
            styleRules.push(styleRule);
        }
        return styleRules;
    },

    _rebuildStyleRules: function(node, styles)
    {
        let nodeComputedStyle = styles.computedStyle;
        this.sections = {};

        let styleRules = [];

        function addAttributesStyle()
        {
            if (!styles.attributesStyle)
                return;
            let attrStyle = { style: styles.attributesStyle, editable: false };
            attrStyle.selectorText = node.nodeNameInCorrectCase() + "[" + WebInspector.UIString("Attributes Style") + "]";
            styleRules.push(attrStyle);
        }

        styleRules.push({ computedStyle: true, selectorText: "", style: nodeComputedStyle, editable: false });

        // Inline style has the greatest specificity.
        if (styles.inlineStyle && node.nodeType() === Node.ELEMENT_NODE) {
            let inlineStyle = { selectorText: "element.style", style: styles.inlineStyle, isAttribute: true };
            styleRules.push(inlineStyle);
        }

        // Add rules in reverse order to match the cascade order.
        if (styles.matchedCSSRules.length)
            styleRules.push({ isStyleSeparator: true, text: WebInspector.UIString("Matched CSS Rules") });
        let addedAttributesStyle;
        for (let i = styles.matchedCSSRules.length - 1; i >= 0; --i) {
            let rule = styles.matchedCSSRules[i];
            if (!WebInspector.settings.showUserAgentStyles.get() && (rule.isUser || rule.isUserAgent))
                continue;
            if ((rule.isUser || rule.isUserAgent) && !addedAttributesStyle) {
                // Show element's Style Attributes after all author rules.
                addedAttributesStyle = true;
                addAttributesStyle();
            }
            styleRules.push({ style: rule.style, selectorText: rule.selectorText, media: rule.media, sourceURL: rule.sourceURL, rule: rule, editable: !!(rule.style && rule.style.id) });
        }

        if (!addedAttributesStyle)
            addAttributesStyle();

        // Walk the node structure and identify styles with inherited properties.
        let parentNode = node.parentNode;
        function insertInheritedNodeSeparator(node)
        {
            let entry = {};
            entry.isStyleSeparator = true;
            entry.node = node;
            styleRules.push(entry);
        }

        for (let parentOrdinal = 0; parentOrdinal < styles.inherited.length; ++parentOrdinal) {
            let parentStyles = styles.inherited[parentOrdinal];
            let separatorInserted = false;
            if (parentStyles.inlineStyle) {
                if (this._containsInherited(parentStyles.inlineStyle)) {
                    let inlineStyle = { selectorText: WebInspector.UIString("Style Attribute"), style: parentStyles.inlineStyle, isAttribute: true, isInherited: true };
                    if (!separatorInserted) {
                        insertInheritedNodeSeparator(parentNode);
                        separatorInserted = true;
                    }
                    styleRules.push(inlineStyle);
                }
            }

            for (let i = parentStyles.matchedCSSRules.length - 1; i >= 0; --i) {
                let rulePayload = parentStyles.matchedCSSRules[i];
                if (!this._containsInherited(rulePayload.style))
                    continue;
                let rule = rulePayload;
                if (!WebInspector.settings.showUserAgentStyles.get() && (rule.isUser || rule.isUserAgent))
                    continue;

                if (!separatorInserted) {
                    insertInheritedNodeSeparator(parentNode);
                    separatorInserted = true;
                }
                styleRules.push({ style: rule.style, selectorText: rule.selectorText, media: rule.media, sourceURL: rule.sourceURL, rule: rule, isInherited: true, editable: !!(rule.style && rule.style.id) });
            }
            parentNode = parentNode.parentNode;
        }
        return styleRules;
    },

    _markUsedProperties: function(styleRules, usedProperties)
    {
        let priorityUsed = false;

        // Walk the style rules and make a list of all used and overloaded properties.
        for (let i = 0; i < styleRules.length; ++i) {
            let styleRule = styleRules[i];
            if (styleRule.computedStyle || styleRule.isStyleSeparator)
                continue;
            if (styleRule.section && styleRule.section.noAffect)
                continue;

            styleRule.usedProperties = {};

            let style = styleRule.style;
            let allProperties = style.allProperties;
            for (let j = 0; j < allProperties.length; ++j) {
                let property = allProperties[j];
                if (!property.isLive || !property.parsedOk)
                    continue;
                let canonicalName = WebInspector.StylesSidebarPane.canonicalPropertyName(property.name);

                if (!priorityUsed && property.priority.length)
                    priorityUsed = true;

                // If the property name is already used by another rule then this rule's
                // property is overloaded, so don't add it to the rule's usedProperties.
                if (!(canonicalName in usedProperties))
                    styleRule.usedProperties[canonicalName] = true;
            }

            // Add all the properties found in this style to the used properties list.
            // Do this here so only future rules are affect by properties used in this rule.
            for (let canonicalName in styleRules[i].usedProperties)
                usedProperties[canonicalName] = true;
        }

        if (priorityUsed) {
            // Walk the properties again and account for !important.
            let foundPriorityProperties = {};

            // Walk in direct order to detect the active/most specific rule providing a priority
            // (in this case all subsequent !important values get canceled.)
            for (let i = 0; i < styleRules.length; ++i) {
                if (styleRules[i].computedStyle || styleRules[i].isStyleSeparator)
                    continue;

                let style = styleRules[i].style;
                let allProperties = style.allProperties;
                for (let j = 0; j < allProperties.length; ++j) {
                    let property = allProperties[j];
                    if (!property.isLive)
                        continue;
                    let canonicalName = WebInspector.StylesSidebarPane.canonicalPropertyName(property.name);
                    if (property.priority.length) {
                        if (!(canonicalName in foundPriorityProperties))
                            styleRules[i].usedProperties[canonicalName] = true;
                        else
                            delete styleRules[i].usedProperties[canonicalName];
                        foundPriorityProperties[canonicalName] = true;
                    } else if (canonicalName in foundPriorityProperties)
                        delete styleRules[i].usedProperties[canonicalName];
                }
            }
        }
    },

    _refreshSectionsForStyleRules: function(styleRules, usedProperties, editedSection)
    {
        // Walk the style rules and update the sections with new overloaded and used properties.
        for (let i = 0; i < styleRules.length; ++i) {
            let styleRule = styleRules[i];
            let section = styleRule.section;
            if (styleRule.computedStyle) {
                section._usedProperties = usedProperties;
                section.update();
            } else {
                section._usedProperties = styleRule.usedProperties;
                section.update(section === editedSection);
            }
        }
    },

    _rebuildSectionsForStyleRules: function(styleRules, usedProperties, pseudoId, anchorElement)
    {
        // Make a property section for each style rule.
        let sections = [];
        let lastWasSeparator = true;
        for (let i = 0; i < styleRules.length; ++i) {
            let styleRule = styleRules[i];
            if (styleRule.isStyleSeparator) {
                let separatorElement = document.createElement("div");
                separatorElement.className = "sidebar-separator";
                if (styleRule.node) {
                    let link = WebInspector.DOMPresentationUtils.linkifyNodeReference(styleRule.node);
                    separatorElement.appendChild(document.createTextNode(WebInspector.UIString("Inherited from") + " "));
                    separatorElement.appendChild(link);
                    if (!sections.inheritedPropertiesSeparatorElement)
                        sections.inheritedPropertiesSeparatorElement = separatorElement;
                } else if ("pseudoId" in styleRule) {
                    let pseudoName = WebInspector.StylesSidebarPane.PseudoIdNames[styleRule.pseudoId];
                    if (pseudoName)
                        separatorElement.textContent = WebInspector.UIString("Pseudo ::%s element", pseudoName);
                    else
                        separatorElement.textContent = WebInspector.UIString("Pseudo element");
                } else
                    separatorElement.textContent = styleRule.text;
                this._sectionsContainer.insertBefore(separatorElement, anchorElement);
                lastWasSeparator = true;
                continue;
            }
            let computedStyle = styleRule.computedStyle;

            // Default editable to true if it was omitted.
            let editable = styleRule.editable;
            if (typeof editable === "undefined")
                editable = true;

            if (computedStyle)
                let section = new WebInspector.ComputedStylePropertiesSection(styleRule, usedProperties);
            else
                let section = new WebInspector.StylePropertiesSection(this, styleRule, editable, styleRule.isInherited, lastWasSeparator);
            section.pane = this;
            section.expanded = true;

            if (computedStyle) {
                this._computedStylePane.bodyElement.appendChild(section.element);
                lastWasSeparator = true;
            } else {
                this._sectionsContainer.insertBefore(section.element, anchorElement);
                lastWasSeparator = false;
            }
            sections.push(section);
        }
        return sections;
    },

    _containsInherited: function(style)
    {
        let properties = style.allProperties;
        for (let i = 0; i < properties.length; ++i) {
            let property = properties[i];
            // Does this style contain non-overridden inherited property?
            if (property.isLive && property.name in WebInspector.CSSKeywordCompletions.InheritedProperties)
                return true;
        }
        return false;
    },

    _colorFormatSettingChanged: function(event)
    {
        this._updateColorFormatFilter();
        for (let pseudoId in this.sections) {
            let sections = this.sections[pseudoId];
            for (let i = 0; i < sections.length; ++i)
                sections[i].update(true);
        }
    },

    _updateColorFormatFilter: function()
    {
        // Select the correct color format setting again, since it needs to be selected.
        let selectedIndex = 0;
        let value = WebInspector.settings.colorFormat.get();
        let options = this.settingsSelectElement.options;
        for (let i = 0; i < options.length; ++i) {
            if (options[i].value === value) {
                selectedIndex = i;
                break;
            }
        }
        this.settingsSelectElement.selectedIndex = selectedIndex;
    },

    _changeSetting: function(event)
    {
        let options = this.settingsSelectElement.options;
        let selectedOption = options[this.settingsSelectElement.selectedIndex];
        WebInspector.settings.colorFormat.set(selectedOption.value);
    },

    _createNewRule: function(event)
    {
        event.consume();
        this.expanded = true;
        this.addBlankSection().startEditingSelector();
    },

    addBlankSection: function()
    {
        let blankSection = new WebInspector.BlankStylePropertiesSection(this, this.node ? this.node.appropriateSelectorFor(true) : "");
        blankSection.pane = this;

        let elementStyleSection = this.sections[0][1];
        this._sectionsContainer.insertBefore(blankSection.element, elementStyleSection.element.nextSibling);

        this.sections[0].splice(2, 0, blankSection);

        return blankSection;
    },

    removeSection: function(section)
    {
        for (let pseudoId in this.sections) {
            let sections = this.sections[pseudoId];
            let index = sections.indexOf(section);
            if (index === -1)
                continue;
            sections.splice(index, 1);
            if (section.element.parentNode)
                section.element.parentNode.removeChild(section.element);
        }
    },

    registerShortcuts: function()
    {
        let section = WebInspector.shortcutsScreen.section(WebInspector.UIString("Styles Pane"));
        let shortcut = WebInspector.KeyboardShortcut;
        let keys = [
            shortcut.shortcutToString(shortcut.Keys.Tab),
            shortcut.shortcutToString(shortcut.Keys.Tab, shortcut.Modifiers.Shift)
        ];
        section.addRelatedKeys(keys, WebInspector.UIString("Next/previous property"));
        keys = [
            shortcut.shortcutToString(shortcut.Keys.Up),
            shortcut.shortcutToString(shortcut.Keys.Down)
        ];
        section.addRelatedKeys(keys, WebInspector.UIString("Increment/decrement value"));
        keys = [
            shortcut.shortcutToString(shortcut.Keys.Up, shortcut.Modifiers.Shift),
            shortcut.shortcutToString(shortcut.Keys.Down, shortcut.Modifiers.Shift)
        ];
        section.addRelatedKeys(keys, WebInspector.UIString("Increment/decrement by %f", 10));
        keys = [
            shortcut.shortcutToString(shortcut.Keys.PageUp),
            shortcut.shortcutToString(shortcut.Keys.PageDown)
        ];
        section.addRelatedKeys(keys, WebInspector.UIString("Increment/decrement by %f", 10));
        keys = [
            shortcut.shortcutToString(shortcut.Keys.PageUp, shortcut.Modifiers.Shift),
            shortcut.shortcutToString(shortcut.Keys.PageDown, shortcut.Modifiers.Shift)
        ];
        section.addRelatedKeys(keys, WebInspector.UIString("Increment/decrement by %f", 100));
        keys = [
            shortcut.shortcutToString(shortcut.Keys.PageUp, shortcut.Modifiers.Alt),
            shortcut.shortcutToString(shortcut.Keys.PageDown, shortcut.Modifiers.Alt)
        ];
        section.addRelatedKeys(keys, WebInspector.UIString("Increment/decrement by %f", 0.1));
    },

    _toggleElementStatePane: function(event)
    {
        event.consume();
        if (!this._elementStateButton.hasStyleClass("toggled")) {
            this.expand();
            this._elementStateButton.addStyleClass("toggled");
            this._elementStatePane.addStyleClass("expanded");
        } else {
            this._elementStateButton.removeStyleClass("toggled");
            this._elementStatePane.removeStyleClass("expanded");
            // Clear flags on hide.
            if (this._forcedPseudoClasses) {
                for (let i = 0; i < this._elementStatePane.inputs.length; ++i)
                    this._elementStatePane.inputs[i].checked = false;
                delete this._forcedPseudoClasses;
                this._rebuildUpdate();
            }
        }
    },

    _createElementStatePane: function()
    {
        this._elementStatePane = document.createElement("div");
        this._elementStatePane.className = "styles-element-state-pane source-code";
        let table = document.createElement("table");

        let inputs = [];
        this._elementStatePane.inputs = inputs;

        function clickListener(event)
        {
            let pseudoClasses = [];
            for (let i = 0; i < inputs.length; ++i) {
                if (inputs[i].checked)
                    pseudoClasses.push(inputs[i].state);
            }
            this._forcedPseudoClasses = pseudoClasses.length ? pseudoClasses : undefined;
            this._rebuildUpdate();
        }

        function createCheckbox(state)
        {
            let td = document.createElement("td");
            let label = document.createElement("label");
            let input = document.createElement("input");
            input.type = "checkbox";
            input.state = state;
            input.addEventListener("click", clickListener.bind(this), false);
            inputs.push(input);
            label.appendChild(input);
            label.appendChild(document.createTextNode(":" + state));
            td.appendChild(label);
            return td;
        }

        let tr = document.createElement("tr");
        tr.appendChild(createCheckbox.call(this, "active"));
        tr.appendChild(createCheckbox.call(this, "hover"));
        table.appendChild(tr);

        tr = document.createElement("tr");
        tr.appendChild(createCheckbox.call(this, "focus"));
        tr.appendChild(createCheckbox.call(this, "visited"));
        table.appendChild(tr);

        this._elementStatePane.appendChild(table);
    },

    _showUserAgentStylesSettingChanged: function()
    {
        this._rebuildUpdate();
    },

    willHide: function()
    {
        if (this._spectrum.visible)
            this._spectrum.hide();
    }
}

WebInspector.StylesSidebarPane.prototype.__proto__ = WebInspector.SidebarPane.prototype;

/**
 * @constructor
 * @extends {WebInspector.SidebarPane}
 */
WebInspector.ComputedStyleSidebarPane = function()
{
    WebInspector.SidebarPane.call(this, WebInspector.UIString("Computed Style"));
    let showInheritedCheckbox = new WebInspector.Checkbox(WebInspector.UIString("Show inherited"), "sidebar-pane-subtitle");
    this.titleElement.appendChild(showInheritedCheckbox.element);

    if (WebInspector.settings.showInheritedComputedStyleProperties.get()) {
        this.bodyElement.addStyleClass("show-inherited");
        showInheritedCheckbox.checked = true;
    }

    function showInheritedToggleFunction(event)
    {
        WebInspector.settings.showInheritedComputedStyleProperties.set(showInheritedCheckbox.checked);
        if (WebInspector.settings.showInheritedComputedStyleProperties.get())
            this.bodyElement.addStyleClass("show-inherited");
        else
            this.bodyElement.removeStyleClass("show-inherited");
    }

    showInheritedCheckbox.addEventListener(showInheritedToggleFunction.bind(this));
}

WebInspector.ComputedStyleSidebarPane.prototype = {

    // Overriding expand() rather than onexpand() to eliminate the visual slowness due to a possible backend trip.
    expand: function()
    {
        function callback()
        {
            WebInspector.SidebarPane.prototype.expand.call(this);
        }

        this._stylesSidebarPane._refreshUpdate(null, true, callback.bind(this));
    }
}

WebInspector.ComputedStyleSidebarPane.prototype.__proto__ = WebInspector.SidebarPane.prototype;

/**
 * @constructor
 * @extends {WebInspector.PropertiesSection}
 */
WebInspector.StylePropertiesSection = function(parentPane, styleRule, editable, isInherited, isFirstSection)
{
    WebInspector.PropertiesSection.call(this, "");
    this.element.className = "styles-section matched-styles monospace" + (isFirstSection ? " first-styles-section" : "");

    if (styleRule.media) {
        for (let i = styleRule.media.length - 1; i >= 0; --i) {
            let media = styleRule.media[i];
            let mediaDataElement = this.titleElement.createChild("div", "media");
            let mediaText;
            switch (media.source) {
            case WebInspector.CSSMedia.Source.LINKED_SHEET:
            case WebInspector.CSSMedia.Source.INLINE_SHEET:
                mediaText = "media=\"" + media.text + "\"";
                break;
            case WebInspector.CSSMedia.Source.MEDIA_RULE:
                mediaText = "@media " + media.text;
                break;
            case WebInspector.CSSMedia.Source.IMPORT_RULE:
                mediaText = "@import " + media.text;
                break;
            }

            if (media.sourceURL) {
                let refElement = mediaDataElement.createChild("div", "subtitle");
                let lineNumber = media.sourceLine < 0 ? undefined : media.sourceLine;
                let anchor = WebInspector.linkifyResourceAsNode(media.sourceURL, lineNumber, "subtitle", media.sourceURL + (isNaN(lineNumber) ? "" : (":" + (lineNumber + 1))));
                anchor.style.float = "right";
                refElement.appendChild(anchor);
            }

            let mediaTextElement = mediaDataElement.createChild("span");
            mediaTextElement.textContent = mediaText;
            mediaTextElement.title = media.text;
        }
    }

    let selectorContainer = document.createElement("div");
    this._selectorElement = document.createElement("span");
    this._selectorElement.textContent = styleRule.selectorText;
    selectorContainer.appendChild(this._selectorElement);

    let openBrace = document.createElement("span");
    openBrace.textContent = " {";
    selectorContainer.appendChild(openBrace);
    selectorContainer.addEventListener("mousedown", this._handleEmptySpaceMouseDown.bind(this), false);
    selectorContainer.addEventListener("click", this._handleSelectorContainerClick.bind(this), false);

    let closeBrace = document.createElement("div");
    closeBrace.textContent = "}";
    this.element.appendChild(closeBrace);

    this._selectorElement.addEventListener("click", this._handleSelectorClick.bind(this), false);
    this.element.addEventListener("mousedown", this._handleEmptySpaceMouseDown.bind(this), false);
    this.element.addEventListener("click", this._handleEmptySpaceClick.bind(this), false);

    this._parentPane = parentPane;
    this.styleRule = styleRule;
    this.rule = this.styleRule.rule;
    this.editable = editable;
    this.isInherited = isInherited;

    if (this.rule) {
        // Prevent editing the user agent and user rules.
        if (this.rule.isUserAgent || this.rule.isUser)
            this.editable = false;
        this.titleElement.addStyleClass("styles-selector");
    }

    this._usedProperties = styleRule.usedProperties;

    this._selectorRefElement = document.createElement("div");
    this._selectorRefElement.className = "subtitle";
    this._selectorRefElement.appendChild(this._createRuleOriginNode());
    selectorContainer.insertBefore(this._selectorRefElement, selectorContainer.firstChild);
    this.titleElement.appendChild(selectorContainer);
    this._selectorContainer = selectorContainer;

    if (isInherited)
        this.element.addStyleClass("show-inherited"); // This one is related to inherited rules, not compted style.

    if (!this.editable)
        this.element.addStyleClass("read-only");
}

WebInspector.StylePropertiesSection.prototype = {
    collapse: function(dontRememberState)
    {
        // Overriding with empty body.
    },

    isPropertyInherited: function(propertyName)
    {
        if (this.isInherited) {
            // While rendering inherited stylesheet, reverse meaning of this property.
            // Render truly inherited properties with black, i.e. return them as non-inherited.
            return !(propertyName in WebInspector.CSSKeywordCompletions.InheritedProperties);
        }
        return false;
    },

    isPropertyOverloaded: function(propertyName, shorthand)
    {
        if (!this._usedProperties || this.noAffect)
            return false;

        if (this.isInherited && !(propertyName in WebInspector.CSSKeywordCompletions.InheritedProperties)) {
            // In the inherited sections, only show overrides for the potentially inherited properties.
            return false;
        }

        let canonicalName = WebInspector.StylesSidebarPane.canonicalPropertyName(propertyName);
        let used = (canonicalName in this._usedProperties);
        if (used || !shorthand)
            return !used;

        // Find out if any of the individual longhand properties of the shorthand
        // are used, if none are then the shorthand is overloaded too.
        let longhandProperties = this.styleRule.style.getLonghandProperties(propertyName);
        for (let j = 0; j < longhandProperties.length; ++j) {
            let individualProperty = longhandProperties[j];
            if (WebInspector.StylesSidebarPane.canonicalPropertyName(individualProperty.name) in this._usedProperties)
                return false;
        }

        return true;
    },

    nextEditableSibling: function()
    {
        let curSection = this;
        do {
            curSection = curSection.nextSibling;
        } while (curSection && !curSection.editable);

        if (!curSection) {
            curSection = this.firstSibling;
            while (curSection && !curSection.editable)
                curSection = curSection.nextSibling;
        }

        return (curSection && curSection.editable) ? curSection : null;
    },

    previousEditableSibling: function()
    {
        let curSection = this;
        do {
            curSection = curSection.previousSibling;
        } while (curSection && !curSection.editable);

        if (!curSection) {
            curSection = this.lastSibling;
            while (curSection && !curSection.editable)
                curSection = curSection.previousSibling;
        }

        return (curSection && curSection.editable) ? curSection : null;
    },

    update: function(full)
    {
        if (full) {
            this.propertiesTreeOutline.removeChildren();
            this.populated = false;
        } else {
            let child = this.propertiesTreeOutline.children[0];
            while (child) {
                child.overloaded = this.isPropertyOverloaded(child.name, child.shorthand);
                child = child.traverseNextTreeElement(false, null, true);
            }
        }
        this.afterUpdate();
    },

    afterUpdate: function()
    {
        if (this._afterUpdate) {
            this._afterUpdate(this);
            delete this._afterUpdate;
        }
    },

    onpopulate: function()
    {
        let style = this.styleRule.style;

        let handledProperties = {};
        let shorthandNames = {};

        this.uniqueProperties = [];
        let allProperties = style.allProperties;
        for (let i = 0; i < allProperties.length; ++i)
            this.uniqueProperties.push(allProperties[i]);

        // Collect all shorthand names.
        for (let i = 0; i < this.uniqueProperties.length; ++i) {
            let property = this.uniqueProperties[i];
            if (property.disabled)
                continue;
            if (property.shorthand)
                shorthandNames[property.shorthand] = true;
        }

        // Create property tree elements.
        for (let i = 0; i < this.uniqueProperties.length; ++i) {
            let property = this.uniqueProperties[i];
            let disabled = property.disabled;
            let shorthand = !disabled ? property.shorthand : null;

            if (shorthand && shorthand in handledProperties)
                continue;

            if (shorthand) {
                property = style.getLiveProperty(shorthand);
                if (!property)
                    property = new WebInspector.CSSProperty(style, style.allProperties.length, shorthand, style.getShorthandValue(shorthand), style.getShorthandPriority(shorthand), "style", true, true, "", undefined);
            }

            // BUG71275: Never show purely style-based properties in editable rules.
            if (!shorthand && this.editable && property.styleBased)
                continue;

            let isShorthand = !!(property.isLive && (shorthand || shorthandNames[property.name]));
            let inherited = this.isPropertyInherited(property.name);
            let overloaded = this.isPropertyOverloaded(property.name, isShorthand);

            let item = new WebInspector.StylePropertyTreeElement(this, this._parentPane, this.styleRule, style, property, isShorthand, inherited, overloaded);
            this.propertiesTreeOutline.appendChild(item);
            handledProperties[property.name] = property;
        }
    },

    findTreeElementWithName: function(name)
    {
        let treeElement = this.propertiesTreeOutline.children[0];
        while (treeElement) {
            if (treeElement.name === name)
                return treeElement;
            treeElement = treeElement.traverseNextTreeElement(true, null, true);
        }
        return null;
    },

    _checkWillCancelEditing: function()
    {
        let willCauseCancelEditing = this._willCauseCancelEditing;
        delete this._willCauseCancelEditing;
        return willCauseCancelEditing;
    },

    _handleSelectorContainerClick: function(event)
    {
        if (this._checkWillCancelEditing())
            return;
        if (event.target === this._selectorContainer)
            this.addNewBlankProperty(0).startEditing();
    },

    /**
     * @param {number=} index
     */
    addNewBlankProperty: function(index)
    {
        let style = this.styleRule.style;
        let property = style.newBlankProperty(index);
        let item = new WebInspector.StylePropertyTreeElement(this, this._parentPane, this.styleRule, style, property, false, false, false);
        index = property.index;
        this.propertiesTreeOutline.insertChild(item, index);
        item.listItemElement.textContent = "";
        item._newProperty = true;
        item.updateTitle();
        return item;
    },

    _createRuleOriginNode: function()
    {
        function linkifyUncopyable(url, line)
        {
            let link = WebInspector.linkifyResourceAsNode(url, line, "", url + ":" + (line + 1));
            link.classList.add("webkit-html-resource-link");
            link.setAttribute("data-uncopyable", link.textContent);
            link.textContent = "";
            return link;
        }

        if (this.styleRule.sourceURL)
            return linkifyUncopyable(this.styleRule.sourceURL, this.rule.sourceLine);
        if (!this.rule)
            return document.createTextNode("");

        let origin = "";
        if (this.rule.isUserAgent)
            origin = WebInspector.UIString("user agent stylesheet");
        else if (this.rule.isUser)
            origin = WebInspector.UIString("user stylesheet");
        else if (this.rule.isViaInspector)
            origin = WebInspector.UIString("via inspector");
        return document.createTextNode(origin);
    },

    _handleEmptySpaceMouseDown: function(event)
    {
        this._willCauseCancelEditing = this._parentPane._isEditingStyle;
    },

    _handleEmptySpaceClick: function(event)
    {
        if (!this.editable)
            return;

        if (this._checkWillCancelEditing())
            return;

        if (event.target.hasStyleClass("header") || this.element.hasStyleClass("read-only") || event.target.enclosingNodeOrSelfWithClass("media")) {
            event.consume();
            return;
        }
        this.expand();
        this.addNewBlankProperty().startEditing();
    },

    _handleSelectorClick: function(event)
    {
        this._startEditingOnMouseEvent();
        event.consume(true);
    },

    _startEditingOnMouseEvent: function()
    {
        if (!this.editable)
            return;

        if (!this.rule && this.propertiesTreeOutline.children.length === 0) {
            this.expand();
            this.addNewBlankProperty().startEditing();
            return;
        }

        if (!this.rule)
            return;

        this.startEditingSelector();
    },

    startEditingSelector: function()
    {
        let element = this._selectorElement;
        if (WebInspector.isBeingEdited(element))
            return;

        this._selectorElement.scrollIntoViewIfNeeded(false);

        let config = new WebInspector.EditingConfig(this.editingSelectorCommitted.bind(this), this.editingSelectorCancelled.bind(this));
        WebInspector.startEditing(this._selectorElement, config);

        window.getSelection().setBaseAndExtent(element, 0, element, 1);
    },

    _moveEditorFromSelector: function(moveDirection)
    {
        if (!moveDirection)
            return;

        if (moveDirection === "forward") {
            this.expand();
            let firstChild = this.propertiesTreeOutline.children[0];
            if (!firstChild)
                this.addNewBlankProperty().startEditing();
            else
                firstChild.startEditing(firstChild.nameElement);
        } else {
            let previousSection = this.previousEditableSibling();
            if (!previousSection)
                return;

            previousSection.expand();
            previousSection.addNewBlankProperty().startEditing();
        }
    },

    editingSelectorCommitted: function(element, newContent, oldContent, context, moveDirection)
    {
        if (newContent)
            newContent = newContent.trim();
        if (newContent === oldContent) {
            // Revert to a trimmed version of the selector if need be.
            this._selectorElement.textContent = newContent;
            return this._moveEditorFromSelector(moveDirection);
        }

        function successCallback(newRule, doesAffectSelectedNode)
        {
            if (!doesAffectSelectedNode) {
                this.noAffect = true;
                this.element.addStyleClass("no-affect");
            } else {
                delete this.noAffect;
                this.element.removeStyleClass("no-affect");
            }

            this.rule = newRule;
            this.styleRule = { section: this, style: newRule.style, selectorText: newRule.selectorText, media: newRule.media, sourceURL: newRule.sourceURL, rule: newRule };

            this.pane.update();

            this._moveEditorFromSelector(moveDirection);
        }

        let selectedNode = WebInspector.panels.elements.selectedDOMNode();
        WebInspector.cssModel.setRuleSelector(this.rule.id, selectedNode ? selectedNode.id : 0, newContent, successCallback.bind(this), this._moveEditorFromSelector.bind(this, moveDirection));
    },

    editingSelectorCancelled: function()
    {
        // Do nothing, this is overridden by BlankStylePropertiesSection.
    }
}

WebInspector.StylePropertiesSection.prototype.__proto__ = WebInspector.PropertiesSection.prototype;

/**
 * @constructor
 * @extends {WebInspector.PropertiesSection}
 */
WebInspector.ComputedStylePropertiesSection = function(styleRule, usedProperties)
{
    WebInspector.PropertiesSection.call(this, "");
    this.headerElement.addStyleClass("hidden");
    this.element.className = "styles-section monospace first-styles-section read-only computed-style";
    this.styleRule = styleRule;
    this._usedProperties = usedProperties;
    this._alwaysShowComputedProperties = { "display": true, "height": true, "width": true };
    this.computedStyle = true;
    this._propertyTreeElements = {};
    this._expandedPropertyNames = {};
}

WebInspector.ComputedStylePropertiesSection.prototype = {
    collapse: function(dontRememberState)
    {
        // Overriding with empty body.
    },

    _isPropertyInherited: function(propertyName)
    {
        return !(propertyName in this._usedProperties) && !(propertyName in this._alwaysShowComputedProperties);
    },

    update: function()
    {
        this._expandedPropertyNames = {};
        for (let name in this._propertyTreeElements) {
            if (this._propertyTreeElements[name].expanded)
                this._expandedPropertyNames[name] = true;
        }
        this._propertyTreeElements = {};
        this.propertiesTreeOutline.removeChildren();
        this.populated = false;
    },

    onpopulate: function()
    {
        function sorter(a, b)
        {
            return a.name.localeCompare(b.name);
        }

        let style = this.styleRule.style;
        if (!style)
            return;

        let uniqueProperties = [];
        let allProperties = style.allProperties;
        for (let i = 0; i < allProperties.length; ++i)
            uniqueProperties.push(allProperties[i]);
        uniqueProperties.sort(sorter);

        this._propertyTreeElements = {};
        for (let i = 0; i < uniqueProperties.length; ++i) {
            let property = uniqueProperties[i];
            let inherited = this._isPropertyInherited(property.name);
            let item = new WebInspector.StylePropertyTreeElement(this, null, this.styleRule, style, property, false, inherited, false);
            this.propertiesTreeOutline.appendChild(item);
            this._propertyTreeElements[property.name] = item;
        }
    },

    rebuildComputedTrace: function(sections)
    {
        for (let i = 0; i < sections.length; ++i) {
            let section = sections[i];
            if (section.computedStyle || section.isBlank)
                continue;

            for (let j = 0; j < section.uniqueProperties.length; ++j) {
                let property = section.uniqueProperties[j];
                if (property.disabled)
                    continue;
                if (section.isInherited && !(property.name in WebInspector.CSSKeywordCompletions.InheritedProperties))
                    continue;

                let treeElement = this._propertyTreeElements[property.name];
                if (treeElement) {
                    let fragment = document.createDocumentFragment();
                    let selector = fragment.createChild("span");
                    selector.style.color = "gray";
                    selector.textContent = section.styleRule.selectorText;
                    fragment.appendChild(document.createTextNode(" - " + property.value + " "));
                    let subtitle = fragment.createChild("span");
                    subtitle.style.float = "right";
                    subtitle.appendChild(section._createRuleOriginNode());
                    let childElement = new TreeElement(fragment, null, false);
                    treeElement.appendChild(childElement);
                    if (section.isPropertyOverloaded(property.name))
                        childElement.listItemElement.addStyleClass("overloaded");
                    if (!property.parsedOk)
                        childElement.listItemElement.addStyleClass("not-parsed-ok");
                }
            }
        }

        // Restore expanded state after update.
        for (let name in this._expandedPropertyNames) {
            if (name in this._propertyTreeElements)
                this._propertyTreeElements[name].expand();
        }
    }
}

WebInspector.ComputedStylePropertiesSection.prototype.__proto__ = WebInspector.PropertiesSection.prototype;

/**
 * @constructor
 * @extends {WebInspector.StylePropertiesSection}
 */
WebInspector.BlankStylePropertiesSection = function(parentPane, defaultSelectorText)
{
    WebInspector.StylePropertiesSection.call(this, parentPane, {selectorText: defaultSelectorText, rule: {isViaInspector: true}}, true, false, false);
    this.element.addStyleClass("blank-section");
}

WebInspector.BlankStylePropertiesSection.prototype = {
    get isBlank()
    {
        return !this._normal;
    },

    expand: function()
    {
        if (!this.isBlank)
            WebInspector.StylePropertiesSection.prototype.expand.call(this);
    },

    editingSelectorCommitted: function(element, newContent, oldContent, context, moveDirection)
    {
        if (!this.isBlank) {
            WebInspector.StylePropertiesSection.prototype.editingSelectorCommitted.call(this, element, newContent, oldContent, context, moveDirection);
            return;
        }

        function successCallback(newRule, doesSelectorAffectSelectedNode)
        {
            let styleRule = { section: this, style: newRule.style, selectorText: newRule.selectorText, sourceURL: newRule.sourceURL, rule: newRule };
            this.makeNormal(styleRule);

            if (!doesSelectorAffectSelectedNode) {
                this.noAffect = true;
                this.element.addStyleClass("no-affect");
            }

            this._selectorRefElement.textContent = WebInspector.UIString("via inspector");
            this.expand();
            if (this.element.parentElement) // Might have been detached already.
                this._moveEditorFromSelector(moveDirection);

            delete this._parentPane._userOperation;
        }

        this._parentPane._userOperation = true;
        WebInspector.cssModel.addRule(this.pane.node.id, newContent, successCallback.bind(this), this.editingSelectorCancelled.bind(this));
    },

    editingSelectorCancelled: function()
    {
        if (!this.isBlank) {
            WebInspector.StylePropertiesSection.prototype.editingSelectorCancelled.call(this);
            return;
        }

        this.pane.removeSection(this);
    },

    makeNormal: function(styleRule)
    {
        this.element.removeStyleClass("blank-section");
        this.styleRule = styleRule;
        this.rule = styleRule.rule;

        // FIXME: replace this instance by a normal WebInspector.StylePropertiesSection.
        this._normal = true;
    }
}

WebInspector.BlankStylePropertiesSection.prototype.__proto__ = WebInspector.StylePropertiesSection.prototype;

/**
 * @constructor
 * @extends {TreeElement}
 * @param {?WebInspector.StylesSidebarPane} parentPane
 */
WebInspector.StylePropertyTreeElement = function(section, parentPane, styleRule, style, property, shorthand, inherited, overloaded)
{
    this.section = section;
    this._parentPane = parentPane;
    this._styleRule = styleRule;
    this.style = style;
    this.property = property;
    this.shorthand = shorthand;
    this._inherited = inherited;
    this._overloaded = overloaded;

    // Pass an empty title, the title gets made later in onattach.
    TreeElement.call(this, "", null, shorthand);

    this.selectable = false;
}

WebInspector.StylePropertyTreeElement.prototype = {
    get inherited()
    {
        return this._inherited;
    },

    set inherited(x)
    {
        if (x === this._inherited)
            return;
        this._inherited = x;
        this.updateState();
    },

    get overloaded()
    {
        return this._overloaded;
    },

    set overloaded(x)
    {
        if (x === this._overloaded)
            return;
        this._overloaded = x;
        this.updateState();
    },

    get disabled()
    {
        return this.property.disabled;
    },

    get name()
    {
        if (!this.disabled || !this.property.text)
            return this.property.name;

        let text = this.property.text;
        let index = text.indexOf(":");
        if (index < 1)
            return this.property.name;

        return text.substring(0, index).trim();
    },

    get priority()
    {
        if (this.disabled)
            return ""; // rely upon raw text to render it in the value field
        return this.property.priority;
    },

    get value()
    {
        if (!this.disabled || !this.property.text)
            return this.property.value;

        let match = this.property.text.match(/(.*);\s*/);
        if (!match || !match[1])
            return this.property.value;

        let text = match[1];
        let index = text.indexOf(":");
        if (index < 1)
            return this.property.value;

        return text.substring(index + 1).trim();
    },

    get parsedOk()
    {
        return this.property.parsedOk;
    },

    onattach: function()
    {
        this.updateTitle();
        this.listItemElement.addEventListener("mousedown", this._mouseDown.bind(this));
        this.listItemElement.addEventListener("mouseup", this._resetMouseDownElement.bind(this));
        this.listItemElement.addEventListener("click", this._mouseClick.bind(this));
    },

    _mouseDown: function(event)
    {
        if (this._parentPane) {
            this._parentPane._mouseDownTreeElement = this;
            this._parentPane._mouseDownTreeElementIsName = this._isNameElement(event.target);
            this._parentPane._mouseDownTreeElementIsValue = this._isValueElement(event.target);
        }
    },

    _resetMouseDownElement: function()
    {
        if (this._parentPane) {
            delete this._parentPane._mouseDownTreeElement;
            delete this._parentPane._mouseDownTreeElementIsName;
            delete this._parentPane._mouseDownTreeElementIsValue;
        }
    },

    updateTitle: function()
    {
        let value = this.value;

        this.updateState();

        let enabledCheckboxElement;
        if (this.parsedOk) {
            enabledCheckboxElement = document.createElement("input");
            enabledCheckboxElement.className = "enabled-button";
            enabledCheckboxElement.type = "checkbox";
            enabledCheckboxElement.checked = !this.disabled;
            enabledCheckboxElement.addEventListener("change", this.toggleEnabled.bind(this), false);
        }

        let nameElement = document.createElement("span");
        nameElement.className = "webkit-css-property";
        nameElement.textContent = this.name;
        nameElement.title = this.property.propertyText;
        this.nameElement = nameElement;

        this._expandElement = document.createElement("span");
        this._expandElement.className = "expand-element";

        let valueElement = document.createElement("span");
        valueElement.className = "value";
        this.valueElement = valueElement;

        let cf = WebInspector.StylesSidebarPane.ColorFormat;

        if (value) {
            let self = this;

            function processValue(regex, processor, nextProcessor, valueText)
            {
                let container = document.createDocumentFragment();

                let items = valueText.replace(regex, "\0$1\0").split("\0");
                for (let i = 0; i < items.length; ++i) {
                    if ((i % 2) === 0) {
                        if (nextProcessor)
                            container.appendChild(nextProcessor(items[i]));
                        else
                            container.appendChild(document.createTextNode(items[i]));
                    } else {
                        let processedNode = processor(items[i]);
                        if (processedNode)
                            container.appendChild(processedNode);
                    }
                }

                return container;
            }

            function linkifyURL(url)
            {
                let hrefUrl = url;
                let match = hrefUrl.match(/['"]?([^'"]+)/);
                if (match)
                    hrefUrl = match[1];
                let container = document.createDocumentFragment();
                container.appendChild(document.createTextNode("url("));
                if (self._styleRule.sourceURL)
                    hrefUrl = WebInspector.completeURL(self._styleRule.sourceURL, hrefUrl);
                else if (WebInspector.panels.elements.selectedDOMNode())
                    hrefUrl = WebInspector.resourceURLForRelatedNode(WebInspector.panels.elements.selectedDOMNode(), hrefUrl);
                let hasResource = !!WebInspector.resourceForURL(hrefUrl);
                // FIXME: WebInspector.linkifyURLAsNode() should really use baseURI.
                container.appendChild(WebInspector.linkifyURLAsNode(hrefUrl, url, undefined, !hasResource));
                container.appendChild(document.createTextNode(")"));
                return container;
            }

            function processColor(text)
            {
                try {
                    let color = new WebInspector.Color(text);
                } catch (e) {
                    return document.createTextNode(text);
                }

                let format = getFormat();
                let hasSpectrum = self._parentPane;
                let spectrum = hasSpectrum ? self._parentPane._spectrum : null;

                let swatchElement = document.createElement("span");
                let swatchInnerElement = swatchElement.createChild("span", "swatch-inner");
                swatchElement.title = WebInspector.UIString("Click to open a colorpicker. Shift-click to change color format");

                swatchElement.className = "swatch";

                swatchElement.addEventListener("mousedown", consumeEvent, false);
                swatchElement.addEventListener("click", swatchClick, false);
                swatchElement.addEventListener("dblclick", consumeEvent, false);

                swatchInnerElement.style.backgroundColor = text;

                let scrollerElement = hasSpectrum ? self._parentPane._computedStylePane.element.parentElement : null;

                function spectrumChanged(e)
                {
                    color = e.data;

                    let colorString = color.toString();

                    colorValueElement.textContent = colorString;
                    spectrum.displayText = colorString;
                    swatchInnerElement.style.backgroundColor = colorString;

                    self.applyStyleText(nameElement.textContent + ": " + valueElement.textContent, false, false, false);
                }

                function spectrumHidden()
                {
                    scrollerElement.removeEventListener("scroll", repositionSpectrum, false);
                    self.applyStyleText(nameElement.textContent + ": " + valueElement.textContent, true, true, false);
                    spectrum.removeEventListener(WebInspector.Spectrum.Events.ColorChanged, spectrumChanged);
                    spectrum.removeEventListener(WebInspector.Spectrum.Events.Hidden, spectrumHidden);

                    delete self._parentPane._isEditingStyle;
                }

                function repositionSpectrum()
                {
                    spectrum.reposition(swatchElement);
                }

                function swatchClick(e)
                {
                    // Shift + click toggles color formats.
                    // Click opens colorpicker, only if the element is not in computed styles section.
                    if (!spectrum || e.shiftKey)
                        changeColorDisplay(e);
                    else {
                        let visible = spectrum.toggle(swatchElement, color, format);

                        if (visible) {
                            spectrum.displayText = color.toString(format);
                            self._parentPane._isEditingStyle = true;
                            spectrum.addEventListener(WebInspector.Spectrum.Events.ColorChanged, spectrumChanged);
                            spectrum.addEventListener(WebInspector.Spectrum.Events.Hidden, spectrumHidden);

                            scrollerElement.addEventListener("scroll", repositionSpectrum, false);
                        }
                    }
                    e.consume(true);
                }

                function getFormat()
                {
                    let format;
                    let formatSetting = WebInspector.settings.colorFormat.get();
                    if (formatSetting === cf.Original)
                        format = cf.Original;
                    else if (color.nickname)
                        format = cf.Nickname;
                    else if (formatSetting === cf.RGB)
                        format = (color.simple ? cf.RGB : cf.RGBA);
                    else if (formatSetting === cf.HSL)
                        format = (color.simple ? cf.HSL : cf.HSLA);
                    else if (color.simple)
                        format = (color.hasShortHex() ? cf.ShortHEX : cf.HEX);
                    else
                        format = cf.RGBA;

                    return format;
                }

                let colorValueElement = document.createElement("span");
                colorValueElement.textContent = color.toString(format);

                function nextFormat(curFormat)
                {
                    // The format loop is as follows:
                    // * original
                    // * rgb(a)
                    // * hsl(a)
                    // * nickname (if the color has a nickname)
                    // * if the color is simple:
                    //   - shorthex (if has short hex)
                    //   - hex
                    switch (curFormat) {
                        case cf.Original:
                            return color.simple ? cf.RGB : cf.RGBA;

                        case cf.RGB:
                        case cf.RGBA:
                            return color.simple ? cf.HSL : cf.HSLA;

                        case cf.HSL:
                        case cf.HSLA:
                            if (color.nickname)
                                return cf.Nickname;
                            if (color.simple)
                                return color.hasShortHex() ? cf.ShortHEX : cf.HEX;
                            else
                                return cf.Original;

                        case cf.ShortHEX:
                            return cf.HEX;

                        case cf.HEX:
                            return cf.Original;

                        case cf.Nickname:
                            if (color.simple)
                                return color.hasShortHex() ? cf.ShortHEX : cf.HEX;
                            else
                                return cf.Original;

                        default:
                            return null;
                    }
                }

                function changeColorDisplay(event)
                {
                    do {
                        format = nextFormat(format);
                        let currentValue = color.toString(format || "");
                    } while (format && currentValue === color.value && format !== cf.Original);

                    if (format)
                        colorValueElement.textContent = currentValue;
                }

                let container = document.createDocumentFragment();
                container.appendChild(swatchElement);
                container.appendChild(colorValueElement);
                return container;
            }

            let colorRegex = /((?:rgb|hsl)a?\([^)]+\)|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|\b\w+\b(?!-))/g;
            let colorProcessor = processValue.bind(window, colorRegex, processColor, null);

            valueElement.appendChild(processValue(/url\(\s*([^)\s]+)\s*\)/g, linkifyURL, WebInspector.CSSKeywordCompletions.isColorAwareProperty(self.name) ? colorProcessor : null, value));
        }

        this.listItemElement.removeChildren();
        nameElement.normalize();
        valueElement.normalize();

        if (!this.treeOutline)
            return;

        // Append the checkbox for root elements of an editable section.
        if (enabledCheckboxElement && this.treeOutline.section && this.parent.root && !this.section.computedStyle)
            this.listItemElement.appendChild(enabledCheckboxElement);
        this.listItemElement.appendChild(nameElement);
        this.listItemElement.appendChild(document.createTextNode(": "));
        this.listItemElement.appendChild(this._expandElement);
        this.listItemElement.appendChild(valueElement);
        this.listItemElement.appendChild(document.createTextNode(";"));

        if (!this.parsedOk) {
            // Avoid having longhands under an invalid shorthand.
            this.hasChildren = false;
            this.listItemElement.addStyleClass("not-parsed-ok");

            // Add a separate exclamation mark IMG element with a tooltip.
            let exclamationElement = document.createElement("img");
            exclamationElement.className = "exclamation-mark";
            exclamationElement.title = WebInspector.CSSCompletions.cssNameCompletions.keySet()[this.property.name.toLowerCase()] ? WebInspector.UIString("Invalid property value.") : WebInspector.UIString("Unknown property name.");
            this.listItemElement.insertBefore(exclamationElement, this.listItemElement.firstChild);
        }
        if (this.property.inactive)
            this.listItemElement.addStyleClass("inactive");
    },

    _updatePane: function(userCallback)
    {
        if (this.treeOutline && this.treeOutline.section && this.treeOutline.section.pane)
            this.treeOutline.section.pane._refreshUpdate(this.treeOutline.section, false, userCallback);
        else  {
            if (userCallback)
                userCallback();
        }
    },

    toggleEnabled: function(event)
    {
        let disabled = !event.target.checked;

        function callback(newStyle)
        {
            if (!newStyle)
                return;

            this.style = newStyle;
            this._styleRule.style = newStyle;

            if (this.treeOutline.section && this.treeOutline.section.pane)
                this.treeOutline.section.pane.dispatchEventToListeners("style property toggled");

            this._updatePane();

            delete this._parentPane._userOperation;
        }

        this._parentPane._userOperation = true;
        this.property.setDisabled(disabled, callback.bind(this));
    },

    updateState: function()
    {
        if (!this.listItemElement)
            return;

        if (this.style.isPropertyImplicit(this.name) || this.value === "initial")
            this.listItemElement.addStyleClass("implicit");
        else
            this.listItemElement.removeStyleClass("implicit");

        if (this.inherited)
            this.listItemElement.addStyleClass("inherited");
        else
            this.listItemElement.removeStyleClass("inherited");

        if (this.overloaded)
            this.listItemElement.addStyleClass("overloaded");
        else
            this.listItemElement.removeStyleClass("overloaded");

        if (this.disabled)
            this.listItemElement.addStyleClass("disabled");
        else
            this.listItemElement.removeStyleClass("disabled");
    },

    onpopulate: function()
    {
        // Only populate once and if this property is a shorthand.
        if (this.children.length || !this.shorthand)
            return;

        let longhandProperties = this.style.getLonghandProperties(this.name);
        for (let i = 0; i < longhandProperties.length; ++i) {
            let name = longhandProperties[i].name;


            if (this.treeOutline.section) {
                let inherited = this.treeOutline.section.isPropertyInherited(name);
                let overloaded = this.treeOutline.section.isPropertyOverloaded(name);
            }

            let liveProperty = this.style.getLiveProperty(name);
            let item = new WebInspector.StylePropertyTreeElement(this, this._parentPane, this._styleRule, this.style, liveProperty, false, inherited, overloaded);
            this.appendChild(item);
        }
    },

    restoreNameElement: function()
    {
        // Restore <span class="webkit-css-property"> if it doesn't yet exist or was accidentally deleted.
        if (this.nameElement === this.listItemElement.querySelector(".webkit-css-property"))
            return;

        this.nameElement = document.createElement("span");
        this.nameElement.className = "webkit-css-property";
        this.nameElement.textContent = "";
        this.listItemElement.insertBefore(this.nameElement, this.listItemElement.firstChild);
    },

    _mouseClick: function(event)
    {
        event.consume(true);

        if (event.target === this.listItemElement) {
            if (!this.section.editable) 
                return;

            if (this.section._checkWillCancelEditing())
                return;
            this.section.addNewBlankProperty(this.property.index + 1).startEditing();
            return;
        }

        this.startEditing(event.target);
    },

    _isNameElement: function(element)
    {
        return element.enclosingNodeOrSelfWithClass("webkit-css-property") === this.nameElement;
    },

    _isValueElement: function(element)
    {
        return !!element.enclosingNodeOrSelfWithClass("value");
    },

    startEditing: function(selectElement)
    {
        // FIXME: we don't allow editing of longhand properties under a shorthand right now.
        if (this.parent.shorthand)
            return;

        if (selectElement === this._expandElement)
            return;

        if (this.treeOutline.section && !this.treeOutline.section.editable)
            return;

        if (!selectElement)
            selectElement = this.nameElement; // No arguments passed in - edit the name element by default.
        else
            selectElement = selectElement.enclosingNodeOrSelfWithClass("webkit-css-property") || selectElement.enclosingNodeOrSelfWithClass("value");

        let isEditingName = selectElement === this.nameElement;
        if (!isEditingName && selectElement !== this.valueElement) {
            // Double-click in the LI - start editing value.
            isEditingName = false;
            selectElement = this.valueElement;
        }

        if (WebInspector.isBeingEdited(selectElement))
            return;

        let context = {
            expanded: this.expanded,
            hasChildren: this.hasChildren,
            isEditingName: isEditingName,
            previousContent: selectElement.textContent
        };

        // Lie about our children to prevent expanding on double click and to collapse shorthands.
        this.hasChildren = false;

        if (selectElement.parentElement)
            selectElement.parentElement.addStyleClass("child-editing");
        selectElement.textContent = selectElement.textContent; // remove color swatch and the like

        function pasteHandler(context, event)
        {
            let data = event.clipboardData.getData("Text");
            if (!data)
                return;
            let colonIdx = data.indexOf(":");
            if (colonIdx < 0)
                return;
            let name = data.substring(0, colonIdx).trim();
            let value = data.substring(colonIdx + 1).trim();

            event.preventDefault();

            if (!("originalName" in context)) {
                context.originalName = this.nameElement.textContent;
                context.originalValue = this.valueElement.textContent;
            }
            this.nameElement.textContent = name;
            this.valueElement.textContent = value;
            this.nameElement.normalize();
            this.valueElement.normalize();

            this.editingCommitted(null, event.target.textContent, context.previousContent, context, "forward");
        }

        function blurListener(context, event)
        {
            let treeElement = this._parentPane._mouseDownTreeElement;
            let moveDirection = "";
            if (treeElement === this) {
                if (isEditingName && this._parentPane._mouseDownTreeElementIsValue)
                    moveDirection = "forward";
                if (!isEditingName && this._parentPane._mouseDownTreeElementIsName)
                    moveDirection = "backward";
            }
            this.editingCommitted(null, event.target.textContent, context.previousContent, context, moveDirection);
        }

        delete this.originalPropertyText;

        this._parentPane._isEditingStyle = true;
        if (selectElement.parentElement)
            selectElement.parentElement.scrollIntoViewIfNeeded(false);

        let applyItemCallback = !isEditingName ? this._applyFreeFlowStyleTextEdit.bind(this, true) : undefined;
        this._prompt = new WebInspector.StylesSidebarPane.CSSPropertyPrompt(isEditingName ? WebInspector.CSSCompletions.cssNameCompletions : WebInspector.CSSKeywordCompletions.forProperty(this.nameElement.textContent), this, isEditingName);
        if (applyItemCallback) {
            this._prompt.addEventListener(WebInspector.TextPrompt.Events.ItemApplied, applyItemCallback, this);
            this._prompt.addEventListener(WebInspector.TextPrompt.Events.ItemAccepted, applyItemCallback, this);
        }
        let proxyElement = this._prompt.attachAndStartEditing(selectElement, blurListener.bind(this, context));

        proxyElement.addEventListener("keydown", this.editingNameValueKeyDown.bind(this, context), false);
        if (isEditingName)
            proxyElement.addEventListener("paste", pasteHandler.bind(this, context));

        window.getSelection().setBaseAndExtent(selectElement, 0, selectElement, 1);
    },

    editingNameValueKeyDown: function(context, event)
    {
        if (event.handled)
            return;

        let isEditingName = context.isEditingName;
        let result;

        function shouldCommitValueSemicolon(text, cursorPosition)
        {
            // FIXME: should this account for semicolons inside comments?
            let openQuote = "";
            for (let i = 0; i < cursorPosition; ++i) {
                let ch = text[i];
                if (ch === "\\" && openQuote !== "")
                    ++i; // skip next character inside string
                else if (!openQuote && (ch === "\"" || ch === "'"))
                    openQuote = ch;
                else if (openQuote === ch)
                    openQuote = "";
            }
            return !openQuote;
        }

        // FIXME: the ":"/";" detection does not work for non-US layouts due to the event being keydown rather than keypress.
        let isFieldInputTerminated = (event.keyCode === WebInspector.KeyboardShortcut.Keys.Semicolon.code) &&
            (isEditingName ? event.shiftKey : (!event.shiftKey && shouldCommitValueSemicolon(event.target.textContent, event.target.selectionLeftOffset())));
        if (isEnterKey(event) || isFieldInputTerminated) {
            // Enter or colon (for name)/semicolon outside of string (for value).
            event.preventDefault();
            result = "forward";
        } else if (event.keyCode === WebInspector.KeyboardShortcut.Keys.Esc.code || event.keyIdentifier === "U+001B")
            result = "cancel";
        else if (!isEditingName && this._newProperty && event.keyCode === WebInspector.KeyboardShortcut.Keys.Backspace.code) {
            // For a new property, when Backspace is pressed at the beginning of new property value, move back to the property name.
            let selection = window.getSelection();
            if (selection.isCollapsed && !selection.focusOffset) {
                event.preventDefault();
                result = "backward";
            }
        } else if (event.keyIdentifier === "U+0009") { // Tab key.
            result = event.shiftKey ? "backward" : "forward";
            event.preventDefault();
        }

        if (result) {
            switch (result) {
            case "cancel":
                this.editingCancelled(null, context);
                break;
            case "forward":
            case "backward":
                this.editingCommitted(null, event.target.textContent, context.previousContent, context, result);
                break;
            }

            event.consume();
            return;
        }

        if (!isEditingName)
            this._applyFreeFlowStyleTextEdit(false);
    },

    _applyFreeFlowStyleTextEdit: function(now)
    {
        if (this._applyFreeFlowStyleTextEditTimer)
            clearTimeout(this._applyFreeFlowStyleTextEditTimer);

        function apply()
        {
            let valueText = this.valueElement.textContent;
            if (valueText.indexOf(";") === -1)
                this.applyStyleText(this.nameElement.textContent + ": " + valueText, false, false, false);
        }
        if (now)
            apply.call(this);
        else
            this._applyFreeFlowStyleTextEditTimer = setTimeout(apply.bind(this), 100);
    },

    kickFreeFlowStyleEditForTest: function()
    {
        this._applyFreeFlowStyleTextEdit(true);
    },

    editingEnded: function(context)
    {
        this._resetMouseDownElement();
        if (this._applyFreeFlowStyleTextEditTimer)
            clearTimeout(this._applyFreeFlowStyleTextEditTimer);

        this.hasChildren = context.hasChildren;
        if (context.expanded)
            this.expand();
        let editedElement = context.isEditingName ? this.nameElement : this.valueElement;
        // The proxyElement has been deleted, no need to remove listener.
        if (editedElement.parentElement)
            editedElement.parentElement.removeStyleClass("child-editing");

        delete this._parentPane._isEditingStyle;
    },

    editingCancelled: function(element, context)
    {
        this._removePrompt();
        this._revertStyleUponEditingCanceled(this.originalPropertyText);
        // This should happen last, as it clears the info necessary to restore the property value after [Page]Up/Down changes.
        this.editingEnded(context);
    },

    _revertStyleUponEditingCanceled: function(originalPropertyText)
    {
        if (typeof originalPropertyText === "string") {
            delete this.originalPropertyText;
            this.applyStyleText(originalPropertyText, true, false, true);
        } else {
            if (this._newProperty)
                this.treeOutline.removeChild(this);
            else
                this.updateTitle();
        }
    },

    _findSibling: function(moveDirection)
    {
        let target = this;
        do {
            target = (moveDirection === "forward" ? target.nextSibling : target.previousSibling);
        } while(target && target.inherited);

        return target;
    },

    editingCommitted: function(element, userInput, previousContent, context, moveDirection)
    {
        this._removePrompt();
        this.editingEnded(context);
        let isEditingName = context.isEditingName;

        // Determine where to move to before making changes
        let createNewProperty, moveToPropertyName, moveToSelector;
        let moveTo = this;
        let moveToOther = (isEditingName ^ (moveDirection === "forward"));
        let abandonNewProperty = this._newProperty && !userInput && (moveToOther || isEditingName);
        if (moveDirection === "forward" && !isEditingName || moveDirection === "backward" && isEditingName) {
            moveTo = moveTo._findSibling(moveDirection);
            if (moveTo)
                moveToPropertyName = moveTo.name;
            else if (moveDirection === "forward" && (!this._newProperty || userInput))
                createNewProperty = true;
            else if (moveDirection === "backward")
                moveToSelector = true;
        }

        // Make the Changes and trigger the moveToNextCallback after updating.
        let moveToIndex = moveTo && this.treeOutline ? this.treeOutline.children.indexOf(moveTo) : -1;
        let blankInput = /^\s*$/.test(userInput);
        let isDataPasted = "originalName" in context;
        let isDirtyViaPaste = isDataPasted && (this.nameElement.textContent !== context.originalName || this.valueElement.textContent !== context.originalValue);
        let shouldCommitNewProperty = this._newProperty && (moveToOther || (!moveDirection && !isEditingName) || (isEditingName && blankInput));
        if (((userInput !== previousContent || isDirtyViaPaste) && !this._newProperty) || shouldCommitNewProperty) {
            this.treeOutline.section._afterUpdate = moveToNextCallback.bind(this, this._newProperty, !blankInput, this.treeOutline.section);
            let propertyText;
            if (blankInput || (this._newProperty && /^\s*$/.test(this.valueElement.textContent)))
                propertyText = "";
            else {
                if (isEditingName)
                    propertyText = userInput + ": " + this.valueElement.textContent;
                else
                    propertyText = this.nameElement.textContent + ": " + userInput;
            }
            this.applyStyleText(propertyText, true, true, false);
        } else {
            if (!isDataPasted && !this._newProperty)
                this.updateTitle();
            moveToNextCallback.call(this, this._newProperty, false, this.treeOutline.section);
        }

        // The Callback to start editing the next/previous property/selector.
        function moveToNextCallback(alreadyNew, valueChanged, section)
        {
            if (!moveDirection)
                return;

            // User just tabbed through without changes.
            if (moveTo && moveTo.parent) {
                moveTo.startEditing(!isEditingName ? moveTo.nameElement : moveTo.valueElement);
                return;
            }

            // User has made a change then tabbed, wiping all the original treeElements.
            // Recalculate the new treeElement for the same property we were going to edit next.
            if (moveTo && !moveTo.parent) {
                let propertyElements = section.propertiesTreeOutline.children;
                if (moveDirection === "forward" && blankInput && !isEditingName)
                    --moveToIndex;
                if (moveToIndex >= propertyElements.length && !this._newProperty)
                    createNewProperty = true;
                else {
                    let treeElement = moveToIndex >= 0 ? propertyElements[moveToIndex] : null;
                    if (treeElement) {
                        let elementToEdit = !isEditingName ? treeElement.nameElement : treeElement.valueElement;
                        if (alreadyNew && blankInput)
                            elementToEdit = moveDirection === "forward" ? treeElement.nameElement : treeElement.valueElement;
                        treeElement.startEditing(elementToEdit);
                        return;
                    } else if (!alreadyNew)
                        moveToSelector = true;
                }
            }

            // Create a new attribute in this section (or move to next editable selector if possible).
            if (createNewProperty) {
                if (alreadyNew && !valueChanged && (isEditingName ^ (moveDirection === "backward")))
                    return;

                section.addNewBlankProperty().startEditing();
                return;
            }

            if (abandonNewProperty) {
                moveTo = this._findSibling(moveDirection);
                let sectionToEdit = (moveTo || moveDirection === "backward") ? section : section.nextEditableSibling();
                if (sectionToEdit) {
                    if (sectionToEdit.rule)
                        sectionToEdit.startEditingSelector();
                    else
                        sectionToEdit._moveEditorFromSelector(moveDirection);
                }
                return;
            }

            if (moveToSelector) {
                if (section.rule)
                    section.startEditingSelector();
                else
                    section._moveEditorFromSelector(moveDirection);
            }
        }
    },

    _removePrompt: function()
    {
        // BUG 53242. This cannot go into editingEnded(), as it should always happen first for any editing outcome.
        if (this._prompt) {
            this._prompt.detach();
            delete this._prompt;
        }
    },

    _hasBeenModifiedIncrementally: function()
    {
        // New properties applied via up/down or live editing have an originalPropertyText and will be deleted later
        // on, if cancelled, when the empty string gets applied as their style text.
        return typeof this.originalPropertyText === "string" || (!!this.property.propertyText && this._newProperty);
    },

    applyStyleText: function(styleText, updateInterface, majorChange, isRevert)
    {
        function userOperationFinishedCallback(parentPane, updateInterface)
        {
            if (updateInterface)
                delete parentPane._userOperation;
        }

        // Leave a way to cancel editing after incremental changes.
        if (!isRevert && !updateInterface && !this._hasBeenModifiedIncrementally()) {
            // Remember the rule's original CSS text on [Page](Up|Down), so it can be restored
            // if the editing is canceled.
            this.originalPropertyText = this.property.propertyText;
        }

        if (!this.treeOutline)
            return;

        let section = this.treeOutline.section;
        let elementsPanel = WebInspector.panels.elements;
        styleText = styleText.replace(/\s/g, " ").trim(); // Replace &nbsp; with whitespace.
        let styleTextLength = styleText.length;
        if (!styleTextLength && updateInterface && !isRevert && this._newProperty && !this._hasBeenModifiedIncrementally()) {
            // The user deleted everything and never applied a new property value via Up/Down scrolling/live editing, so remove the tree element and update.
            this.parent.removeChild(this);
            section.afterUpdate();
            return;
        }

        let currentNode = this._parentPane.node;
        if (updateInterface)
            this._parentPane._userOperation = true;

        function callback(userCallback, originalPropertyText, newStyle)
        {
            if (!newStyle) {
                if (updateInterface) {
                    // It did not apply, cancel editing.
                    this._revertStyleUponEditingCanceled(originalPropertyText);
                }
                userCallback();
                return;
            }

            if (this._newProperty)
                this._newPropertyInStyle = true;
            this.style = newStyle;
            this.property = newStyle.propertyAt(this.property.index);
            this._styleRule.style = this.style;

            if (section && section.pane)
                section.pane.dispatchEventToListeners("style edited");

            if (updateInterface && currentNode === section.pane.node) {
                this._updatePane(userCallback);
                return;
            }

            userCallback();
        }

        // Append a ";" if the new text does not end in ";".
        // FIXME: this does not handle trailing comments.
        if (styleText.length && !/;\s*$/.test(styleText))
            styleText += ";";
        let overwriteProperty = !!(!this._newProperty || this._newPropertyInStyle);
        this.property.setText(styleText, majorChange, overwriteProperty, callback.bind(this, userOperationFinishedCallback.bind(null, this._parentPane, updateInterface), this.originalPropertyText));
    },

    ondblclick: function()
    {
        return true; // handled
    },

    isEventWithinDisclosureTriangle: function(event)
    {
        if (!this.section.computedStyle)
            return event.target === this._expandElement;
        return TreeElement.prototype.isEventWithinDisclosureTriangle.call(this, event);
    }
}

WebInspector.StylePropertyTreeElement.prototype.__proto__ = TreeElement.prototype;

/**
 * @constructor
 * @extends {WebInspector.TextPrompt}
 * @param {function(*)=} acceptCallback
 */
WebInspector.StylesSidebarPane.CSSPropertyPrompt = function(cssCompletions, sidebarPane, isEditingName, acceptCallback)
{
    // Use the same callback both for applyItemCallback and acceptItemCallback.
    WebInspector.TextPrompt.call(this, this._buildPropertyCompletions.bind(this), WebInspector.StylesSidebarPane.StyleValueDelimiters);
    this.setSuggestBoxEnabled("generic-suggest");
    this._cssCompletions = cssCompletions;
    this._sidebarPane = sidebarPane;
    this._isEditingName = isEditingName;
}

WebInspector.StylesSidebarPane.CSSPropertyPrompt.prototype = {
    onKeyDown: function(event)
    {
        switch (event.keyIdentifier) {
        case "Up":
        case "Down":
        case "PageUp":
        case "PageDown":
            if (this._handleNameOrValueUpDown(event)) {
                event.preventDefault();
                return;
            }
            break;
        }

        WebInspector.TextPrompt.prototype.onKeyDown.call(this, event);
    },

    tabKeyPressed: function()
    {
        this.acceptAutoComplete();

        // Always tab to the next field.
        return false;
    },

    _handleNameOrValueUpDown: function(event)
    {
        // Handle numeric value increment/decrement only at this point.
        if (!this._isEditingName && this._handleUpOrDownValue(event))
            return true;

        return false;
    },

    _handleUpOrDownValue: function(event)
    {
        let arrowKeyPressed = (event.keyIdentifier === "Up" || event.keyIdentifier === "Down");
        let pageKeyPressed = (event.keyIdentifier === "PageUp" || event.keyIdentifier === "PageDown");
        if (!arrowKeyPressed && !pageKeyPressed)
            return false;

        let selection = window.getSelection();
        if (!selection.rangeCount)
            return false;

        let selectionRange = selection.getRangeAt(0);
        if (!selectionRange.commonAncestorContainer.isSelfOrDescendant(this._sidebarPane.valueElement))
            return false;

        let wordRange = selectionRange.startContainer.rangeOfWord(selectionRange.startOffset, WebInspector.StylesSidebarPane.StyleValueDelimiters, this._sidebarPane.valueElement);
        let wordString = wordRange.toString();
        let replacementString;
        let prefix, suffix, number;

        let matches;
        matches = /(.*#)([\da-fA-F]+)(.*)/.exec(wordString);
        if (matches && matches.length) {
            prefix = matches[1];
            suffix = matches[3];
            number = WebInspector.StylesSidebarPane.alteredHexNumber(matches[2], event);

            replacementString = prefix + number + suffix;
        } else {
            matches = /(.*?)(-?(?:\d+(?:\.\d+)?|\.\d+))(.*)/.exec(wordString);
            if (matches && matches.length) {
                prefix = matches[1];
                suffix = matches[3];
                number = WebInspector.StylesSidebarPane.alteredFloatNumber(parseFloat(matches[2]), event);
                if (number === null) {
                    // Need to check for null explicitly.
                    return false;
                }

                replacementString = prefix + number + suffix;
            }
        }

        if (replacementString) {
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

            // Synthesize property text disregarding any comments, custom whitespace etc.
            this._sidebarPane.applyStyleText(this._sidebarPane.nameElement.textContent + ": " + this._sidebarPane.valueElement.textContent, false, false, false);

            return true;
        }
        return false;
    },

    _buildPropertyCompletions: function(textPrompt, wordRange, force, completionsReadyCallback)
    {
        let prefix = wordRange.toString().toLowerCase();
        if (!prefix && !force)
            return;

        let results = this._cssCompletions.startsWith(prefix);
        completionsReadyCallback(results);
    }
}

WebInspector.StylesSidebarPane.CSSPropertyPrompt.prototype.__proto__ = WebInspector.TextPrompt.prototype;