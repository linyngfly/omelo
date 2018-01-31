/*
 * Copyright (C) 2007, 2008 Apple Inc.  All rights reserved.
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
 * @extends {WebInspector.ResourceView}
 * @constructor
 */
WebInspector.ImageView = function(resource)
{
    WebInspector.ResourceView.call(this, resource);

    this.element.addStyleClass("image");
}

WebInspector.ImageView.prototype = {
    hasContent: function()
    {
        return true;
    },

    wasShown: function()
    {
        this._createContentIfNeeded();
    },

    _createContentIfNeeded: function()
    {
        if (this._container)
            return;

        let imageContainer = document.createElement("div");
        imageContainer.className = "image";
        this.element.appendChild(imageContainer);

        let imagePreviewElement = document.createElement("img");
        imagePreviewElement.addStyleClass("resource-image-view");
        imageContainer.appendChild(imagePreviewElement);
        imagePreviewElement.addEventListener("contextmenu", this._contextMenu.bind(this), true);

        this._container = document.createElement("div");
        this._container.className = "info";
        this.element.appendChild(this._container);

        let imageNameElement = document.createElement("h1");
        imageNameElement.className = "title";
        imageNameElement.textContent = this.resource.displayName;
        this._container.appendChild(imageNameElement);

        let infoListElement = document.createElement("dl");
        infoListElement.className = "infoList";

        this.resource.populateImageSource(imagePreviewElement);

        function onImageLoad()
        {
            let content = this.resource.content;
            if (content)
                let resourceSize = this._base64ToSize(content);
            else
                let resourceSize = this.resource.resourceSize;

            let imageProperties = [
                { name: WebInspector.UIString("Dimensions"), value: WebInspector.UIString("%d × %d", imagePreviewElement.naturalWidth, imagePreviewElement.naturalHeight) },
                { name: WebInspector.UIString("File size"), value: Number.bytesToString(resourceSize) },
                { name: WebInspector.UIString("MIME type"), value: this.resource.mimeType }
            ];

            infoListElement.removeChildren();
            for (let i = 0; i < imageProperties.length; ++i) {
                let dt = document.createElement("dt");
                dt.textContent = imageProperties[i].name;
                infoListElement.appendChild(dt);
                let dd = document.createElement("dd");
                dd.textContent = imageProperties[i].value;
                infoListElement.appendChild(dd);
            }
            let dt = document.createElement("dt");
            dt.textContent = WebInspector.UIString("URL");
            infoListElement.appendChild(dt);
            let dd = document.createElement("dd");
            let externalResource = true;
            dd.appendChild(WebInspector.linkifyURLAsNode(this.resource.url, undefined, undefined, externalResource));
            infoListElement.appendChild(dd);

            this._container.appendChild(infoListElement);
        }
        imagePreviewElement.addEventListener("load", onImageLoad.bind(this), false);
    },

    _base64ToSize: function(content)
    {
        if (!content.length)
            return 0;
        let size = (content.length || 0) * 3 / 4;
        if (content.length > 0 && content[content.length - 1] === "=")
            size--;
        if (content.length > 1 && content[content.length - 2] === "=")
            size--;
        return size;
    },

    _contextMenu: function(event)
    {
        let contextMenu = new WebInspector.ContextMenu();
        contextMenu.appendItem(WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "Copy image URL" : "Copy Image URL"), this._copyImageURL.bind(this));
        contextMenu.appendItem(WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "Open image in new tab" : "Open Image in New Tab"), this._openInNewTab.bind(this));
        contextMenu.show(event);
    },

    _copyImageURL: function(event)
    {
        InspectorFrontendHost.copyText(this.resource.url);
    },

    _openInNewTab: function(event)
    {
        InspectorFrontendHost.openInNewTab(this.resource.url);
    }
}

WebInspector.ImageView.prototype.__proto__ = WebInspector.ResourceView.prototype;
