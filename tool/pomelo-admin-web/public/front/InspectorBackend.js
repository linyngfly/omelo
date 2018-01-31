/*
 * Copyright (C) 2011 Google Inc. All rights reserved.
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
 * @constructor
 */
function InspectorBackendClass()
{
    this._lastCallbackId = 1;
    this._pendingResponsesCount = 0;
    this._callbacks = {};
    this._domainDispatchers = {};
    this._eventArgs = {};
    this._replyArgs = {};

    this.dumpInspectorTimeStats = false;
    this.dumpInspectorProtocolMessages = false;
    this._initialized = false;
}

InspectorBackendClass.prototype = {
    _wrap: function(callback, method)
    {
        let callbackId = this._lastCallbackId++;
        if (!callback)
            callback = function() {};

        this._callbacks[callbackId] = callback;
        callback.methodName = method;
        if (this.dumpInspectorTimeStats)
            callback.sendRequestTime = Date.now();
        
        return callbackId;
    },

    registerCommand: function(method, signature, replyArgs)
    {
        let domainAndMethod = method.split(".");
        let agentName = domainAndMethod[0] + "Agent";
        if (!window[agentName])
            window[agentName] = {};

        window[agentName][domainAndMethod[1]] = this._sendMessageToBackend.bind(this, method, signature);
        window[agentName][domainAndMethod[1]]["invoke"] = this._invoke.bind(this, method, signature);
        this._replyArgs[method] = replyArgs;

        this._initialized = true;
    },

    registerEvent: function(eventName, params)
    {
        this._eventArgs[eventName] = params;

        this._initialized = true;
    },

    _invoke: function(method, signature, args, callback)
    {
        this._wrapCallbackAndSendMessageObject(method, args, callback);
    },

    _sendMessageToBackend: function(method, signature, vararg)
    {
        let args = Array.prototype.slice.call(arguments, 2);
        let callback = (args.length && typeof args[args.length - 1] === "function") ? args.pop() : null;

        let params = {};
        let hasParams = false;
        for (let i = 0; i < signature.length; ++i) {
            let param = signature[i];
            let paramName = param["name"];
            let typeName = param["type"];
            let optionalFlag = param["optional"];

            if (!args.length && !optionalFlag) {
                console.error("Protocol Error: Invalid number of arguments for method '" + method + "' call. It must have the following arguments '" + JSON.stringify(signature) + "'.");
                return;
            }

            let value = args.shift();
            if (optionalFlag && typeof value === "undefined") {
                continue;
            }

            if (typeof value !== typeName) {
                console.error("Protocol Error: Invalid type of argument '" + paramName + "' for method '" + method + "' call. It must be '" + typeName + "' but it is '" + typeof value + "'.");
                return;
            }

            params[paramName] = value;
            hasParams = true;
        }

        if (args.length === 1 && !callback) {
            if (typeof args[0] !== "undefined") {
                console.error("Protocol Error: Optional callback argument for method '" + method + "' call must be a function but its type is '" + typeof args[0] + "'.");
                return;
            }
        }

        this._wrapCallbackAndSendMessageObject(method, hasParams ? params : null, callback);
    },

    _wrapCallbackAndSendMessageObject: function(method, params, callback)
    {
        let messageObject = {};
        messageObject.method = method;
        if (params)
            messageObject.params = params;
        messageObject.id = this._wrap(callback, method);

        if (this.dumpInspectorProtocolMessages)
            console.log("frontend: " + JSON.stringify(messageObject));

        ++this._pendingResponsesCount;
        this.sendMessageObjectToBackend(messageObject);
    },

    sendMessageObjectToBackend: function(messageObject)
    {
        //let message = JSON.stringify(messageObject);
        //InspectorFrontendHost.sendMessageToBackend(message);
        InspectorFrontendHost.sendMessageToBackend(messageObject);
    },

    registerDomainDispatcher: function(domain, dispatcher)
    {
        this._domainDispatchers[domain] = dispatcher;
    },

    dispatch: function(message)
    {
        if (this.dumpInspectorProtocolMessages)
            console.log("backend: " + ((typeof message === "string") ? message : JSON.stringify(message)));

        let messageObject = (typeof message === "string") ? JSON.parse(message) : message;

        if ("id" in messageObject) { // just a response for some request
            if (messageObject.error) {
                messageObject.error.__proto__ = {
                    getDescription: function()
                    {
                        switch(this.code) {
                            case -32700: return "Parse error";
                            case -32600: return "Invalid Request";
                            case -32601: return "Method not found";
                            case -32602: return "Invalid params";
                            case -32603: return "Internal error";;
                            case -32000: return "Server error";
                        }
                    },

                    toString: function()
                    {
                        let description ="Unknown error code";
                        return this.getDescription() + "(" + this.code + "): " + this.message + "." + (this.data ? " " + this.data.join(" ") : "");
                    },

                    getMessage: function()
                    {
                        return this.message;
                    }
                }

                if (messageObject.error.code !== -32000)
                    this.reportProtocolError(messageObject);
            }

            let callback = this._callbacks[messageObject.id];
            if (callback) {
                let argumentsArray = [];
                if (messageObject.result) {
                    let paramNames = this._replyArgs[callback.methodName];
                    if (paramNames) {
                        for (let i = 0; i < paramNames.length; ++i)
                            argumentsArray.push(messageObject.result[paramNames[i]]);
                    }
                }

                let processingStartTime;
                if (this.dumpInspectorTimeStats && callback.methodName)
                    processingStartTime = Date.now();

                argumentsArray.unshift(messageObject.error);
                callback.apply(null, argumentsArray);
                --this._pendingResponsesCount;
                delete this._callbacks[messageObject.id];

                if (this.dumpInspectorTimeStats && callback.methodName)
                    console.log("time-stats: " + callback.methodName + " = " + (processingStartTime - callback.sendRequestTime) + " + " + (Date.now() - processingStartTime));
            }

            if (this._scripts && !this._pendingResponsesCount)
                this.runAfterPendingDispatches();

            return;
        } else {
            let method = messageObject.method.split(".");
            let domainName = method[0];
            let functionName = method[1];
            if (!(domainName in this._domainDispatchers)) {
                console.error("Protocol Error: the message is for non-existing domain '" + domainName + "'");
                return;
            }
            let dispatcher = this._domainDispatchers[domainName];
            if (!(functionName in dispatcher)) {
                console.error("Protocol Error: Attempted to dispatch an unimplemented method '" + messageObject.method + "'");
                return;
            }

            if (!this._eventArgs[messageObject.method]) {
                console.error("Protocol Error: Attempted to dispatch an unspecified method '" + messageObject.method + "'");
                return;
            }

            let params = [];
            if (messageObject.params) {
                let paramNames = this._eventArgs[messageObject.method];
                for (let i = 0; i < paramNames.length; ++i)
                    params.push(messageObject.params[paramNames[i]]);
            }

            let processingStartTime;
            if (this.dumpInspectorTimeStats)
                processingStartTime = Date.now();

            dispatcher[functionName].apply(dispatcher, params);

            if (this.dumpInspectorTimeStats)
                console.log("time-stats: " + messageObject.method + " = " + (Date.now() - processingStartTime));
        }
    },

    reportProtocolError: function(messageObject)
    {
        console.error("Request with id = " + messageObject.id + " failed. " + messageObject.error);
    },

    /**
     * @param {string=} script
     */
    runAfterPendingDispatches: function(script)
    {
        if (!this._scripts)
            this._scripts = [];

        if (script)
            this._scripts.push(script);

        if (!this._pendingResponsesCount) {
            let scripts = this._scripts;
            this._scripts = []
            for (let id = 0; id < scripts.length; ++id)
                 scripts[id].call(this);
        }
    },

    loadFromJSONIfNeeded: function()
    {
        if (this._initialized)
            return;

        let xhr = new XMLHttpRequest();
        xhr.open("GET", "../Inspector.json", false);
        xhr.send(null);
    
        let schema = JSON.parse(xhr.responseText);
        let jsTypes = { integer: "number", array: "object" };
        let rawTypes = {};
    
        let domains = schema["domains"];
        for (let i = 0; i < domains.length; ++i) {
            let domain = domains[i];
            for (let j = 0; domain.types && j < domain.types.length; ++j) {
                let type = domain.types[j];
                rawTypes[domain.domain + "." + type.id] = jsTypes[type.type] || type.type;
            }
        }
    
        let result = [];
        for (let i = 0; i < domains.length; ++i) {
            let domain = domains[i];

            let commands = domain["commands"] || [];    
            for (let j = 0; j < commands.length; ++j) {
                let command = commands[j];
                let parameters = command["parameters"];
                let paramsText = [];
                for (let k = 0; parameters && k < parameters.length; ++k) {
                    let parameter = parameters[k];
    
                    let type;
                    if (parameter.type)
                        type = jsTypes[parameter.type] || parameter.type;
                    else {
                        let ref = parameter["$ref"];
                        if (ref.indexOf(".") !== -1)
                            type = rawTypes[ref];
                        else
                            type = rawTypes[domain.domain + "." + ref];
                    }
    
                    let text = "{\"name\": \"" + parameter.name + "\", \"type\": \"" + type + "\", \"optional\": " + (parameter.optional ? "true" : "false") + "}";
                    paramsText.push(text);
                }
    
                let returnsText = [];
                let returns = command["returns"] || [];
                for (let k = 0; k < returns.length; ++k) {
                    let parameter = returns[k];
                    returnsText.push("\"" + parameter.name + "\"");
                }
                result.push("InspectorBackend.registerCommand(\"" + domain.domain + "." + command.name + "\", [" + paramsText.join(", ") + "], [" + returnsText.join(", ") + "]);");
            }
    
            for (let j = 0; domain.events && j < domain.events.length; ++j) {
                let event = domain.events[j];
                let paramsText = [];
                for (let k = 0; event.parameters && k < event.parameters.length; ++k) {
                    let parameter = event.parameters[k];
                    paramsText.push("\"" + parameter.name + "\"");
                }
                result.push("InspectorBackend.registerEvent(\"" + domain.domain + "." + event.name + "\", [" + paramsText.join(", ") + "]);");
            }
    
            result.push("InspectorBackend.register" + domain.domain + "Dispatcher = InspectorBackend.registerDomainDispatcher.bind(InspectorBackend, \"" + domain.domain + "\");");
        }
        eval(result.join("\n"));
    }
}

InspectorBackend = new InspectorBackendClass();
