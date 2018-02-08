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
WebInspector.EventListenersSidebarPane = function()
{
    WebInspector.SidebarPane.call(this, WebInspector.UIString("Event Listeners"));
    this.bodyElement.addStyleClass("events-pane");

    this.sections = [];

    this.settingsSelectElement = document.createElement("select");
    this.settingsSelectElement.className = "select-filter";

    let option = document.createElement("option");
    option.value = "all";
    option.label = WebInspector.UIString("All Nodes");
    this.settingsSelectElement.appendChild(option);

    option = document.createElement("option");
    option.value = "selected";
    option.label = WebInspector.UIString("Selected Node Only");
    this.settingsSelectElement.appendChild(option);

    let filter = WebInspector.settings.eventListenersFilter.get();
    if (filter === "all")
        this.settingsSelectElement[0].selected = true;
    else if (filter === "selected")
        this.settingsSelectElement[1].selected = true;
    this.settingsSelectElement.addEventListener("click", function(event) { event.consume() }, false);
    this.settingsSelectElement.addEventListener("change", this._changeSetting.bind(this), false);

    this.titleElement.appendChild(this.settingsSelectElement);

    this._linkifier = WebInspector.debuggerPresentationModel.createLinkifier();
}

WebInspector.EventListenersSidebarPane._objectGroupName = "event-listeners-sidebar-pane";

WebInspector.EventListenersSidebarPane.prototype = {
    update: function(node)
    {
        RuntimeAgent.releaseObjectGroup(WebInspector.EventListenersSidebarPane._objectGroupName);
        this._linkifier.reset();

        let body = this.bodyElement;
        body.removeChildren();
        this.sections = [];

        let self = this;
        function callback(error, eventListeners) {
            if (error)
                return;

            let selectedNodeOnly = "selected" === WebInspector.settings.eventListenersFilter.get();
            let sectionNames = [];
            let sectionMap = {};
            for (let i = 0; i < eventListeners.length; ++i) {
                let eventListener = eventListeners[i];
                if (selectedNodeOnly && (node.id !== eventListener.nodeId))
                    continue;
                eventListener.node = WebInspector.domAgent.nodeForId(eventListener.nodeId);
                delete eventListener.nodeId; // no longer needed
                if (/^function _inspectorCommandLineAPI_logEvent\(/.test(eventListener.handlerBody.toString()))
                    continue; // ignore event listeners generated by monitorEvent
                let type = eventListener.type;
                let section = sectionMap[type];
                if (!section) {
                    section = new WebInspector.EventListenersSection(type, node.id, self._linkifier);
                    sectionMap[type] = section;
                    sectionNames.push(type);
                    self.sections.push(section);
                }
                section.addListener(eventListener);
            }

            if (sectionNames.length === 0) {
                let div = document.createElement("div");
                div.className = "info";
                div.textContent = WebInspector.UIString("No Event Listeners");
                body.appendChild(div);
                return;
            }

            sectionNames.sort();
            for (let i = 0; i < sectionNames.length; ++i) {
                let section = sectionMap[sectionNames[i]];
                body.appendChild(section.element);
            }
        }

        if (node)
            node.eventListeners(callback);
        this._selectedNode = node;
    },

    willHide: function()
    {
        delete this._selectedNode;
    },

    _changeSetting: function()
    {
        let selectedOption = this.settingsSelectElement[this.settingsSelectElement.selectedIndex];
        WebInspector.settings.eventListenersFilter.set(selectedOption.value);
        this.update(this._selectedNode);
    }
}

WebInspector.EventListenersSidebarPane.prototype.__proto__ = WebInspector.SidebarPane.prototype;

/**
 * @constructor
 * @extends {WebInspector.PropertiesSection}
 */
WebInspector.EventListenersSection = function(title, nodeId, linkifier)
{
    this.eventListeners = [];
    this._nodeId = nodeId;
    this._linkifier = linkifier;
    WebInspector.PropertiesSection.call(this, title);

    // Changed from a Properties List
    this.propertiesElement.parentNode.removeChild(this.propertiesElement);
    delete this.propertiesElement;
    delete this.propertiesTreeOutline;

    this._eventBars = document.createElement("div");
    this._eventBars.className = "event-bars";
    this.element.appendChild(this._eventBars);
}

WebInspector.EventListenersSection.prototype = {
    addListener: function(eventListener)
    {
        let eventListenerBar = new WebInspector.EventListenerBar(eventListener, this._nodeId, this._linkifier);
        this._eventBars.appendChild(eventListenerBar.element);
    }
}

WebInspector.EventListenersSection.prototype.__proto__ = WebInspector.PropertiesSection.prototype;

/**
 * @constructor
 * @extends {WebInspector.ObjectPropertiesSection}
 */
WebInspector.EventListenerBar = function(eventListener, nodeId, linkifier)
{
    WebInspector.ObjectPropertiesSection.call(this);

    this.eventListener = eventListener;
    this._nodeId = nodeId;
    this._setNodeTitle();
    this._setFunctionSubtitle(linkifier);
    this.editable = false;
    this.element.className = "event-bar"; /* Changed from "section" */
    this.headerElement.addStyleClass("source-code");
    this.propertiesElement.className = "event-properties properties-tree source-code"; /* Changed from "properties" */
}

WebInspector.EventListenerBar.prototype = {
    update: function()
    {
        function updateWithNodeObject(nodeObject)
        {
            let properties = [];

            if (this.eventListener.type)
                properties.push(WebInspector.RemoteObjectProperty.fromPrimitiveValue("type", this.eventListener.type));
            if (typeof this.eventListener.useCapture !== "undefined")
                properties.push(WebInspector.RemoteObjectProperty.fromPrimitiveValue("useCapture", this.eventListener.useCapture));
            if (typeof this.eventListener.isAttribute !== "undefined")
                properties.push(WebInspector.RemoteObjectProperty.fromPrimitiveValue("isAttribute", this.eventListener.isAttribute));
            if (nodeObject)
                properties.push(new WebInspector.RemoteObjectProperty("node", nodeObject));
            if (typeof this.eventListener.handlerBody !== "undefined")
                properties.push(WebInspector.RemoteObjectProperty.fromPrimitiveValue("listenerBody", this.eventListener.handlerBody));
            if (this.eventListener.location) {
                properties.push(WebInspector.RemoteObjectProperty.fromPrimitiveValue("sourceName", this.eventListener.location.scriptId));
                properties.push(WebInspector.RemoteObjectProperty.fromPrimitiveValue("lineNumber", this.eventListener.location.lineNumber));
            }

            this.updateProperties(properties);
        }
        WebInspector.RemoteObject.resolveNode(this.eventListener.node, WebInspector.EventListenersSidebarPane._objectGroupName, updateWithNodeObject.bind(this));
    },

    _setNodeTitle: function()
    {
        let node = this.eventListener.node;
        if (!node)
            return;

        if (node.nodeType() === Node.DOCUMENT_NODE) {
            this.titleElement.textContent = "document";
            return;
        }

        if (node.id === this._nodeId) {
            this.titleElement.textContent = node.appropriateSelectorFor();
            return;
        }

        this.titleElement.removeChildren();
        this.titleElement.appendChild(WebInspector.DOMPresentationUtils.linkifyNodeReference(this.eventListener.node));
    },

    _setFunctionSubtitle: function(linkifier)
    {
        // Requires that Function.toString() return at least the function's signature.
        if (this.eventListener.location) {
            this.subtitleElement.removeChildren();
            // FIXME(62725): eventListener.location should be a debugger Location.
            let url = this.eventListener.location.scriptId;
            let lineNumber = this.eventListener.location.lineNumber - 1;
            let columnNumber = 0;
            let urlElement = linkifier.linkifyLocation(url, lineNumber, columnNumber);
            this.subtitleElement.appendChild(urlElement);
        } else {
            let match = this.eventListener.handlerBody.match(/function ([^\(]+?)\(/);
            if (match)
                this.subtitleElement.textContent = match[1];
            else
                this.subtitleElement.textContent = WebInspector.UIString("(anonymous function)");
        }
    }
}

WebInspector.EventListenerBar.prototype.__proto__ = WebInspector.ObjectPropertiesSection.prototype;