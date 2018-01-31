/*
 * Copyright (C) 2012 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @param {WebInspector.TimelinePanel} timelinePanel
 * @param {number} sidebarWidth
 * @constructor
 */
WebInspector.MemoryStatistics = function(timelinePanel, sidebarWidth)
{
    this._timelinePanel = timelinePanel;
    this._counters = [];

    this._containerAnchor = timelinePanel.element.lastChild;
    this._memorySplitView = new WebInspector.SplitView(WebInspector.SplitView.SidebarPosition.Left, undefined, sidebarWidth);
    this._memorySplitView.sidebarElement.addStyleClass("sidebar");
    this._memorySplitView.element.id = "memory-graphs-container";

    this._memorySplitView.addEventListener(WebInspector.SplitView.EventTypes.Resized, this._sidebarResized.bind(this));

    this._canvasContainer = this._memorySplitView.mainElement;
    this._canvasContainer.id = "memory-graphs-canvas-container";
    this._currentValuesBar = this._canvasContainer.createChild("div");
    this._currentValuesBar.id = "counter-values-bar";
    this._canvas = this._canvasContainer.createChild("canvas");
    this._canvas.id = "memory-counters-graph";
    this._lastMarkerXPosition = 0;

    this._canvas.addEventListener("mouseover", this._onMouseOver.bind(this), true);
    this._canvas.addEventListener("mousemove", this._onMouseMove.bind(this), true);
    this._canvas.addEventListener("mouseout", this._onMouseOut.bind(this), true);
    this._canvas.addEventListener("click", this._onClick.bind(this), true);
    // We create extra timeline grid here to reuse its event dividers.
    this._timelineGrid = new WebInspector.TimelineGrid();
    this._canvasContainer.appendChild(this._timelineGrid.dividersElement);

    // Populate sidebar
    this._memorySplitView.sidebarElement.createChild("div", "sidebar-tree sidebar-tree-section").textContent = WebInspector.UIString("COUNTERS");
    function getDocumentCount(entry)
    {
        return entry.documentCount;
    }
    function getNodeCount(entry)
    {
        return entry.nodeCount;
    }
    function getListenerCount(entry)
    {
        return entry.listenerCount;
    }
    this._counterUI = [
        new WebInspector.CounterUI(this, "Document Count", "Documents: %d", [100,0,0], getDocumentCount),
        new WebInspector.CounterUI(this, "DOM Node Count", "Nodes: %d", [0,100,0], getNodeCount),
        new WebInspector.CounterUI(this, "Event Listener Count", "Listeners: %d", [0,0,100], getListenerCount)
    ];

    TimelineAgent.setIncludeMemoryDetails(true);
}

/**
 * @constructor
 * @extends {WebInspector.Object}
 */
WebInspector.SwatchCheckbox = function(title, color)
{
    this.element = document.createElement("div");
    this._swatch = this.element.createChild("div", "swatch");
    this.element.createChild("span", "title").textContent = title;
    this._color = color;
    this.checked = true;

    this.element.addEventListener("click", this._toggleCheckbox.bind(this), true);
}

WebInspector.SwatchCheckbox.Events = {
    Changed: "Changed"
}

WebInspector.SwatchCheckbox.prototype = {
    get checked()
    {
        return this._checked;
    },

    set checked(v)
    {
        this._checked = v;
        if (this._checked)
            this._swatch.style.backgroundColor = this._color;
        else
            this._swatch.style.backgroundColor = "";
    },

    _toggleCheckbox: function(event)
    {
        this.checked = !this.checked;
        this.dispatchEventToListeners(WebInspector.SwatchCheckbox.Events.Changed);
    }
}

WebInspector.SwatchCheckbox.prototype.__proto__ = WebInspector.Object.prototype;

/**
 * @constructor
 */
WebInspector.CounterUI = function(memoryCountersPane, title, currentValueLabel, rgb, valueGetter)
{
    this._memoryCountersPane = memoryCountersPane;
    this.valueGetter = valueGetter;
    let container = memoryCountersPane._memorySplitView.sidebarElement.createChild("div", "memory-counter-sidebar-info");
    let swatchColor = "rgb(" + rgb.join(",") + ")";
    this._swatch = new WebInspector.SwatchCheckbox(WebInspector.UIString(title), swatchColor);
    this._swatch.addEventListener(WebInspector.SwatchCheckbox.Events.Changed, this._toggleCounterGraph.bind(this));
    container.appendChild(this._swatch.element);
    this._range = this._swatch.element.createChild("span");

    this._value = memoryCountersPane._currentValuesBar.createChild("span", "memory-counter-value");
    this._value.style.color = swatchColor;
    this._currentValueLabel = currentValueLabel;

    this.graphColor = "rgba(" + rgb.join(",") + ",0.8)";
    this.graphYValues = [];
}

WebInspector.CounterUI.prototype = {
    _toggleCounterGraph: function(event)
    {
        if (this._swatch.checked)
            this._value.removeStyleClass("hidden");
        else
            this._value.addStyleClass("hidden");
        this._memoryCountersPane.refresh();
    },

    setRange: function(minValue, maxValue)
    {
        this._range.textContent = WebInspector.UIString("[ %d - %d ]", minValue, maxValue);
    },

    updateCurrentValue: function(countersEntry)
    {
        this._value.textContent =  WebInspector.UIString(this._currentValueLabel, this.valueGetter(countersEntry));
    },

    clearCurrentValueAndMarker: function(ctx)
    {
        this._value.textContent = "";
        this.restoreImageUnderMarker(ctx);
    },

    get visible()
    {
        return this._swatch.checked;
    },

    saveImageUnderMarker: function(ctx, x, y, radius)
    {
        const w = radius + 1;
        let imageData = ctx.getImageData(x - w, y - w, 2 * w, 2 * w);
        this._imageUnderMarker = {
            x: x - w,
            y: y - w,
            imageData: imageData };
    },

    restoreImageUnderMarker: function(ctx)
    {
        if (!this.visible)
            return;
        if (this._imageUnderMarker)
            ctx.putImageData(this._imageUnderMarker.imageData, this._imageUnderMarker.x, this._imageUnderMarker.y);
        this.discardImageUnderMarker();
    },

    discardImageUnderMarker: function()
    {
        delete this._imageUnderMarker;
    }
}


WebInspector.MemoryStatistics.prototype = {
    reset: function()
    {
        this._counters = [];
    },

    setMainTimelineGrid: function(timelineGrid)
    {
        this._mainTimelineGrid = timelineGrid;
    },

    setTopPosition: function(top)
    {
        this._memorySplitView.element.style.top = top + "px";
        this._updateSize();
    },

    setSidebarWidth: function(width)
    {
        if (this._ignoreSidebarResize)
            return;
        this._ignoreSidebarResize = true;
        this._memorySplitView.setSidebarWidth(width);
        this._ignoreSidebarResize = false;
    },

    _sidebarResized: function(event)
    {
        if (this._ignoreSidebarResize)
            return;
        this._ignoreSidebarResize = true;
        this._timelinePanel.splitView.setSidebarWidth(event.data);
        this._ignoreSidebarResize = false;
    },

    _updateSize: function()
    {
        let width = this._mainTimelineGrid.dividersElement.offsetWidth + 1;
        this._canvasContainer.style.width = width + "px";

        let height = this._canvasContainer.offsetHeight - this._currentValuesBar.offsetHeight;
        this._canvas.width = width;
        this._canvas.height = height;
    },

    addTimlineEvent: function(event)
    {
        let counters = event.data["counters"];
        this._counters.push({
            time: event.data.endTime || event.data.startTime,
            documentCount: counters["documents"],
            nodeCount: counters["nodes"],
            listenerCount: counters["jsEventListeners"]
        });
    },

    _draw: function()
    {
        this._calculateVisibleIndexes();
        this._calculateXValues();
        this._clear();

        this._setVerticalClip(10, this._canvas.height - 20);
        for (let i = 0; i < this._counterUI.length; i++)
            this._drawGraph(this._counterUI[i]);
    },

    _calculateVisibleIndexes: function()
    {
        let calculator = this._timelinePanel.calculator;
        let start = calculator.minimumBoundary * 1000;
        let end = calculator.maximumBoundary * 1000;
        let firstIndex = 0;
        let lastIndex = this._counters.length - 1;
        for (let i = 0; i < this._counters.length; i++) {
            let time = this._counters[i].time;
            if (time <= start) {
                firstIndex = i;
            } else {
                if (end < time)
                    break;
                lastIndex = i;
            }
        }
        // Maximum index of element whose time <= start.
        this._minimumIndex = firstIndex;

        // Maximum index of element whose time <= end.
        this._maximumIndex = lastIndex;

        // Current window bounds.
        this._minTime = start;
        this._maxTime = end;
    },

    _onClick: function(event)
    {
        let x = event.x - event.target.offsetParent.offsetLeft
        let i = this._recordIndexAt(x);
        let counter = this._counters[i];
        this._timelinePanel.revealRecordAt(counter.time / 1000);
    },

    _onMouseOut: function(event)
    {
        delete this._markerXPosition;

        let ctx = this._canvas.getContext("2d");
        for (let i = 0; i < this._counterUI.length; i++)
            this._counterUI[i].clearCurrentValueAndMarker(ctx);
    },

    _onMouseOver: function(event)
    {
        this._onMouseMove(event);
    },

    _onMouseMove: function(event)
    {
        let x = event.x - event.target.offsetParent.offsetLeft
        this._markerXPosition = x;
        this._refreshCurrentValues();
    },

    _refreshCurrentValues: function()
    {
        if (!this._counters.length)
            return;
        if (this._markerXPosition === undefined)
            return;
        let i = this._recordIndexAt(this._markerXPosition);

        for (let j = 0; j < this._counterUI.length; j++)
            this._counterUI[j].updateCurrentValue(this._counters[i]);

        this._highlightCurrentPositionOnGraphs(this._markerXPosition, i);
    },

    _recordIndexAt: function(x)
    {
        let i;
        for (i = this._minimumIndex + 1; i <= this._maximumIndex; i++) {
            let statX = this._counters[i].x;
            if (x < statX)
                break;
        }
        i--;
        return i;
    },

    _highlightCurrentPositionOnGraphs: function(x, index)
    {
        let ctx = this._canvas.getContext("2d");
        for (let i = 0; i < this._counterUI.length; i++) {
            let counterUI = this._counterUI[i];
            if (!counterUI.visible)
                continue;
            counterUI.restoreImageUnderMarker(ctx);
        }

        const radius = 2;
        for (let i = 0; i < this._counterUI.length; i++) {
            let counterUI = this._counterUI[i];
            if (!counterUI.visible)
                continue;
            let y = counterUI.graphYValues[index];
            counterUI.saveImageUnderMarker(ctx, x, y, radius);
        }

        for (let i = 0; i < this._counterUI.length; i++) {
            let counterUI = this._counterUI[i];
            if (!counterUI.visible)
                continue;
            let y = counterUI.graphYValues[index];
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI*2, true);
            ctx.lineWidth = 1;
            ctx.fillStyle = counterUI.graphColor;
            ctx.strokeStyle = counterUI.graphColor;
            ctx.fill();
            ctx.stroke();
            ctx.closePath();
        }
    },

    visible: function()
    {
        return this._memorySplitView.isShowing();
    },

    show: function()
    {
        let anchor = /** @type {Element|null} */ this._containerAnchor.nextSibling;
        this._memorySplitView.show(this._timelinePanel.element, anchor);
        this._updateSize();
        this._refreshDividers();
        setTimeout(this._draw.bind(this), 0);
    },

    refresh: function()
    {
        this._updateSize();
        this._refreshDividers();
        this._draw();
        this._refreshCurrentValues();
    },

    hide: function()
    {
        this._memorySplitView.detach();
    },

    _refreshDividers: function()
    {
        this._timelineGrid.updateDividers(true, this._timelinePanel.calculator, this._timelinePanel.timelinePaddingLeft);
    },

    _setVerticalClip: function(originY, height)
    {
        this._originY = originY;
        this._clippedHeight = height;
    },

    _calculateXValues: function()
    {
        if (!this._counters.length)
            return;

        let width = this._canvas.width;
        let xFactor = width / (this._maxTime - this._minTime);

        this._counters[this._minimumIndex].x = 0;
        for (let i = this._minimumIndex + 1; i < this._maximumIndex; i++)
             this._counters[i].x = xFactor * (this._counters[i].time - this._minTime);
        this._counters[this._maximumIndex].x = width;
    },

    _drawGraph: function(counterUI)
    {
        let canvas = this._canvas;
        let ctx = canvas.getContext("2d");
        let width = canvas.width;
        let height = this._clippedHeight;
        let originY = this._originY;
        let valueGetter = counterUI.valueGetter;

        if (!this._counters.length)
            return;

        let maxValue;
        let minValue;
        for (let i = this._minimumIndex; i <= this._maximumIndex; i++) {
            let value = valueGetter(this._counters[i]);
            if (minValue === undefined || value < minValue)
                minValue = value;
            if (maxValue === undefined || value > maxValue)
                maxValue = value;
        }

        counterUI.setRange(minValue, maxValue);

        if (!counterUI.visible)
            return;

        let yValues = counterUI.graphYValues;
        yValues.length = this._counters.length;

        let maxYRange = maxValue - minValue;
        let yFactor = maxYRange ? height / (maxYRange) : 1;

        ctx.beginPath();
        let currentY = originY + (height - (valueGetter(this._counters[this._minimumIndex])- minValue) * yFactor);
        ctx.moveTo(0, currentY);
        for (let i = this._minimumIndex; i <= this._maximumIndex; i++) {
             let x = this._counters[i].x;
             ctx.lineTo(x, currentY);
             currentY = originY + (height - (valueGetter(this._counters[i])- minValue) * yFactor);
             ctx.lineTo(x, currentY);

             yValues[i] = currentY;
        }
        ctx.lineTo(width, currentY);
        ctx.lineWidth = 1;
        ctx.strokeStyle = counterUI.graphColor;
        ctx.stroke();
        ctx.closePath();
    },

    _clear: function() {
        let ctx = this._canvas.getContext("2d");
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        for (let i = 0; i < this._counterUI.length; i++)
            this._counterUI[i].discardImageUnderMarker();
    }
}

