/*
 * Copyright (C) 2010 Google Inc. All rights reserved.
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

WebInspector.AuditRules.IPAddressRegexp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

WebInspector.AuditRules.CacheableResponseCodes =
{
    200: true,
    203: true,
    206: true,
    300: true,
    301: true,
    410: true,

    304: true // Underlying resource is cacheable
}

WebInspector.AuditRules.getDomainToResourcesMap = function(resources, types, needFullResources)
{
    let domainToResourcesMap = {};
    for (let i = 0, size = resources.length; i < size; ++i) {
        let resource = resources[i];
        if (types && types.indexOf(resource.type) === -1)
            continue;
        let parsedURL = resource.url.asParsedURL();
        if (!parsedURL)
            continue;
        let domain = parsedURL.host;
        let domainResources = domainToResourcesMap[domain];
        if (domainResources === undefined) {
          domainResources = [];
          domainToResourcesMap[domain] = domainResources;
        }
        domainResources.push(needFullResources ? resource : resource.url);
    }
    return domainToResourcesMap;
}

/**
 * @constructor
 * @extends {WebInspector.AuditRule}
 */
WebInspector.AuditRules.GzipRule = function()
{
    WebInspector.AuditRule.call(this, "network-gzip", "Enable gzip compression");
}

WebInspector.AuditRules.GzipRule.prototype = {
    doRun: function(resources, result, callback, progressMonitor)
    {
        let totalSavings = 0;
        let compressedSize = 0;
        let candidateSize = 0;
        let summary = result.addChild("", true);
        for (let i = 0, length = resources.length; i < length; ++i) {
            let resource = resources[i];
            if (resource.statusCode === 304)
                continue; // Do not test 304 Not Modified resources as their contents are always empty.
            if (this._shouldCompress(resource)) {
                let size = resource.resourceSize;
                candidateSize += size;
                if (this._isCompressed(resource)) {
                    compressedSize += size;
                    continue;
                }
                let savings = 2 * size / 3;
                totalSavings += savings;
                summary.addFormatted("%r could save ~%s", resource.url, Number.bytesToString(savings));
                result.violationCount++;
            }
        }
        if (!totalSavings)
            return callback(null);
        summary.value = String.sprintf("Compressing the following resources with gzip could reduce their transfer size by about two thirds (~%s):", Number.bytesToString(totalSavings));
        callback(result);
    },

    _isCompressed: function(resource)
    {
        let encodingHeader = resource.responseHeaders["Content-Encoding"];
        if (!encodingHeader)
            return false;

        return /\b(?:gzip|deflate)\b/.test(encodingHeader);
    },

    _shouldCompress: function(resource)
    {
        return WebInspector.Resource.Type.isTextType(resource.type) && resource.domain && resource.resourceSize !== undefined && resource.resourceSize > 150;
    }
}

WebInspector.AuditRules.GzipRule.prototype.__proto__ = WebInspector.AuditRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRule}
 */
WebInspector.AuditRules.CombineExternalResourcesRule = function(id, name, type, resourceTypeName, allowedPerDomain)
{
    WebInspector.AuditRule.call(this, id, name);
    this._type = type;
    this._resourceTypeName = resourceTypeName;
    this._allowedPerDomain = allowedPerDomain;
}

WebInspector.AuditRules.CombineExternalResourcesRule.prototype = {
    doRun: function(resources, result, callback, progressMonitor)
    {
        let domainToResourcesMap = WebInspector.AuditRules.getDomainToResourcesMap(resources, [this._type], false);
        let penalizedResourceCount = 0;
        // TODO: refactor according to the chosen i18n approach
        let summary = result.addChild("", true);
        for (let domain in domainToResourcesMap) {
            let domainResources = domainToResourcesMap[domain];
            let extraResourceCount = domainResources.length - this._allowedPerDomain;
            if (extraResourceCount <= 0)
                continue;
            penalizedResourceCount += extraResourceCount - 1;
            summary.addChild(String.sprintf("%d %s resources served from %s.", domainResources.length, this._resourceTypeName, WebInspector.AuditRuleResult.resourceDomain(domain)));
            result.violationCount += domainResources.length;
        }
        if (!penalizedResourceCount)
            return callback(null);

        summary.value = "There are multiple resources served from same domain. Consider combining them into as few files as possible.";
        callback(result);
    }
}

WebInspector.AuditRules.CombineExternalResourcesRule.prototype.__proto__ = WebInspector.AuditRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRules.CombineExternalResourcesRule}
 */
WebInspector.AuditRules.CombineJsResourcesRule = function(allowedPerDomain) {
    WebInspector.AuditRules.CombineExternalResourcesRule.call(this, "page-externaljs", "Combine external JavaScript", WebInspector.Resource.Type.Script, "JavaScript", allowedPerDomain);
}

WebInspector.AuditRules.CombineJsResourcesRule.prototype.__proto__ = WebInspector.AuditRules.CombineExternalResourcesRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRules.CombineExternalResourcesRule}
 */
WebInspector.AuditRules.CombineCssResourcesRule = function(allowedPerDomain) {
    WebInspector.AuditRules.CombineExternalResourcesRule.call(this, "page-externalcss", "Combine external CSS", WebInspector.Resource.Type.Stylesheet, "CSS", allowedPerDomain);
}

WebInspector.AuditRules.CombineCssResourcesRule.prototype.__proto__ = WebInspector.AuditRules.CombineExternalResourcesRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRule}
 */
WebInspector.AuditRules.MinimizeDnsLookupsRule = function(hostCountThreshold) {
    WebInspector.AuditRule.call(this, "network-minimizelookups", "Minimize DNS lookups");
    this._hostCountThreshold = hostCountThreshold;
}

WebInspector.AuditRules.MinimizeDnsLookupsRule.prototype = {
    doRun: function(resources, result, callback, progressMonitor)
    {
        let summary = result.addChild("");
        let domainToResourcesMap = WebInspector.AuditRules.getDomainToResourcesMap(resources, undefined, false);
        for (let domain in domainToResourcesMap) {
            if (domainToResourcesMap[domain].length > 1)
                continue;
            let parsedURL = domain.asParsedURL();
            if (!parsedURL)
                continue;
            if (!parsedURL.host.search(WebInspector.AuditRules.IPAddressRegexp))
                continue; // an IP address
            summary.addSnippet(domain);
            result.violationCount++;
        }
        if (!summary.children || summary.children.length <= this._hostCountThreshold)
            return callback(null);

        summary.value = "The following domains only serve one resource each. If possible, avoid the extra DNS lookups by serving these resources from existing domains.";
        callback(result);
    }
}

WebInspector.AuditRules.MinimizeDnsLookupsRule.prototype.__proto__ = WebInspector.AuditRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRule}
 */
WebInspector.AuditRules.ParallelizeDownloadRule = function(optimalHostnameCount, minRequestThreshold, minBalanceThreshold)
{
    WebInspector.AuditRule.call(this, "network-parallelizehosts", "Parallelize downloads across hostnames");
    this._optimalHostnameCount = optimalHostnameCount;
    this._minRequestThreshold = minRequestThreshold;
    this._minBalanceThreshold = minBalanceThreshold;
}

WebInspector.AuditRules.ParallelizeDownloadRule.prototype = {
    doRun: function(resources, result, callback, progressMonitor)
    {
        function hostSorter(a, b)
        {
            let aCount = domainToResourcesMap[a].length;
            let bCount = domainToResourcesMap[b].length;
            return (aCount < bCount) ? 1 : (aCount == bCount) ? 0 : -1;
        }

        let domainToResourcesMap = WebInspector.AuditRules.getDomainToResourcesMap(
            resources,
            [WebInspector.Resource.Type.Stylesheet, WebInspector.Resource.Type.Image],
            true);

        let hosts = [];
        for (let url in domainToResourcesMap)
            hosts.push(url);

        if (!hosts.length)
            return callback(null); // no hosts (local file or something)

        hosts.sort(hostSorter);

        let optimalHostnameCount = this._optimalHostnameCount;
        if (hosts.length > optimalHostnameCount)
            hosts.splice(optimalHostnameCount);

        let busiestHostResourceCount = domainToResourcesMap[hosts[0]].length;
        let resourceCountAboveThreshold = busiestHostResourceCount - this._minRequestThreshold;
        if (resourceCountAboveThreshold <= 0)
            return callback(null);

        let avgResourcesPerHost = 0;
        for (let i = 0, size = hosts.length; i < size; ++i)
            avgResourcesPerHost += domainToResourcesMap[hosts[i]].length;

        // Assume optimal parallelization.
        avgResourcesPerHost /= optimalHostnameCount;
        avgResourcesPerHost = Math.max(avgResourcesPerHost, 1);

        let pctAboveAvg = (resourceCountAboveThreshold / avgResourcesPerHost) - 1.0;
        let minBalanceThreshold = this._minBalanceThreshold;
        if (pctAboveAvg < minBalanceThreshold)
            return callback(null);

        let resourcesOnBusiestHost = domainToResourcesMap[hosts[0]];
        let entry = result.addChild(String.sprintf("This page makes %d parallelizable requests to %s. Increase download parallelization by distributing the following requests across multiple hostnames.", busiestHostResourceCount, hosts[0]), true);
        for (let i = 0; i < resourcesOnBusiestHost.length; ++i)
            entry.addURL(resourcesOnBusiestHost[i].url);

        result.violationCount = resourcesOnBusiestHost.length;
        callback(result);
    }
}

WebInspector.AuditRules.ParallelizeDownloadRule.prototype.__proto__ = WebInspector.AuditRule.prototype;

/**
 * The reported CSS rule size is incorrect (parsed != original in WebKit),
 * so use percentages instead, which gives a better approximation.
 * @constructor
 * @extends {WebInspector.AuditRule}
 */
WebInspector.AuditRules.UnusedCssRule = function()
{
    WebInspector.AuditRule.call(this, "page-unusedcss", "Remove unused CSS rules");
}

WebInspector.AuditRules.UnusedCssRule.prototype = {
    doRun: function(resources, result, callback, progressMonitor)
    {
        let self = this;

        function evalCallback(styleSheets) {
            if (progressMonitor.canceled)
                return;

            if (!styleSheets.length)
                return callback(null);

            let pseudoSelectorRegexp = /:hover|:link|:active|:visited|:focus|:before|:after/;
            let selectors = [];
            let testedSelectors = {};
            for (let i = 0; i < styleSheets.length; ++i) {
                let styleSheet = styleSheets[i];
                for (let curRule = 0; curRule < styleSheet.rules.length; ++curRule) {
                    let selectorText = styleSheet.rules[curRule].selectorText;
                    if (selectorText.match(pseudoSelectorRegexp) || testedSelectors[selectorText])
                        continue;
                    selectors.push(selectorText);
                    testedSelectors[selectorText] = 1;
                }
            }

            function selectorsCallback(callback, styleSheets, testedSelectors, foundSelectors)
            {
                if (progressMonitor.canceled)
                    return;

                let inlineBlockOrdinal = 0;
                let totalStylesheetSize = 0;
                let totalUnusedStylesheetSize = 0;
                let summary;

                for (let i = 0; i < styleSheets.length; ++i) {
                    let styleSheet = styleSheets[i];
                    let stylesheetSize = 0;
                    let unusedStylesheetSize = 0;
                    let unusedRules = [];
                    for (let curRule = 0; curRule < styleSheet.rules.length; ++curRule) {
                        let rule = styleSheet.rules[curRule];
                        // Exact computation whenever source ranges are available.
                        let textLength = (rule.selectorRange && rule.style.range && rule.style.range.end) ? rule.style.range.end - rule.selectorRange.start + 1 : 0;
                        if (!textLength && rule.style.cssText)
                            textLength = rule.style.cssText.length + rule.selectorText.length;
                        stylesheetSize += textLength;
                        if (!testedSelectors[rule.selectorText] || foundSelectors[rule.selectorText])
                            continue;
                        unusedStylesheetSize += textLength;
                        unusedRules.push(rule.selectorText);
                    }
                    totalStylesheetSize += stylesheetSize;
                    totalUnusedStylesheetSize += unusedStylesheetSize;

                    if (!unusedRules.length)
                        continue;

                    let resource = WebInspector.resourceForURL(styleSheet.sourceURL);
                    let isInlineBlock = resource && resource.type == WebInspector.Resource.Type.Document;
                    let url = !isInlineBlock ? WebInspector.AuditRuleResult.linkifyDisplayName(styleSheet.sourceURL) : String.sprintf("Inline block #%d", ++inlineBlockOrdinal);
                    let pctUnused = Math.round(100 * unusedStylesheetSize / stylesheetSize);
                    if (!summary)
                        summary = result.addChild("", true);
                    let entry = summary.addFormatted("%s: %s (%d%) is not used by the current page.", url, Number.bytesToString(unusedStylesheetSize), pctUnused);

                    for (let j = 0; j < unusedRules.length; ++j)
                        entry.addSnippet(unusedRules[j]);

                    result.violationCount += unusedRules.length;
                }

                if (!totalUnusedStylesheetSize)
                    return callback(null);

                let totalUnusedPercent = Math.round(100 * totalUnusedStylesheetSize / totalStylesheetSize);
                summary.value = String.sprintf("%s (%d%) of CSS is not used by the current page.", Number.bytesToString(totalUnusedStylesheetSize), totalUnusedPercent);

                callback(result);
            }

            let foundSelectors = {};
            function queryCallback(boundSelectorsCallback, selector, styleSheets, testedSelectors, nodeId)
            {
                if (nodeId)
                    foundSelectors[selector] = true;
                if (boundSelectorsCallback)
                    boundSelectorsCallback(foundSelectors);
            }

            function documentLoaded(selectors, document) {
                for (let i = 0; i < selectors.length; ++i) {
                    if (progressMonitor.canceled)
                        return;
                    WebInspector.domAgent.querySelector(document.id, selectors[i], queryCallback.bind(null, i === selectors.length - 1 ? selectorsCallback.bind(null, callback, styleSheets, testedSelectors) : null, selectors[i], styleSheets, testedSelectors));
                }
            }

            WebInspector.domAgent.requestDocument(documentLoaded.bind(null, selectors));
        }

        function styleSheetCallback(styleSheets, sourceURL, continuation, styleSheet)
        {
            if (progressMonitor.canceled)
                return;

            if (styleSheet) {
                styleSheet.sourceURL = sourceURL;
                styleSheets.push(styleSheet);
            }
            if (continuation)
                continuation(styleSheets);
        }

        function allStylesCallback(error, styleSheetInfos)
        {
            if (progressMonitor.canceled)
                return;

            if (error || !styleSheetInfos || !styleSheetInfos.length)
                return evalCallback([]);
            let styleSheets = [];
            for (let i = 0; i < styleSheetInfos.length; ++i) {
                let info = styleSheetInfos[i];
                WebInspector.CSSStyleSheet.createForId(info.styleSheetId, styleSheetCallback.bind(null, styleSheets, info.sourceURL, i == styleSheetInfos.length - 1 ? evalCallback : null));
            }
        }

        CSSAgent.getAllStyleSheets(allStylesCallback);
    }
}

WebInspector.AuditRules.UnusedCssRule.prototype.__proto__ = WebInspector.AuditRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRule}
 */
WebInspector.AuditRules.CacheControlRule = function(id, name)
{
    WebInspector.AuditRule.call(this, id, name);
}

WebInspector.AuditRules.CacheControlRule.MillisPerMonth = 1000 * 60 * 60 * 24 * 30;

WebInspector.AuditRules.CacheControlRule.prototype = {

    doRun: function(resources, result, callback, progressMonitor)
    {
        let cacheableAndNonCacheableResources = this._cacheableAndNonCacheableResources(resources);
        if (cacheableAndNonCacheableResources[0].length)
            this.runChecks(cacheableAndNonCacheableResources[0], result);
        this.handleNonCacheableResources(cacheableAndNonCacheableResources[1], result);

        callback(result);
    },

    handleNonCacheableResources: function(resources, result)
    {
    },

    _cacheableAndNonCacheableResources: function(resources)
    {
        let processedResources = [[], []];
        for (let i = 0; i < resources.length; ++i) {
            let resource = resources[i];
            if (!this.isCacheableResource(resource))
                continue;
            if (this._isExplicitlyNonCacheable(resource))
                processedResources[1].push(resource);
            else
                processedResources[0].push(resource);
        }
        return processedResources;
    },

    execCheck: function(messageText, resourceCheckFunction, resources, result)
    {
        let resourceCount = resources.length;
        let urls = [];
        for (let i = 0; i < resourceCount; ++i) {
            if (resourceCheckFunction.call(this, resources[i]))
                urls.push(resources[i].url);
        }
        if (urls.length) {
            let entry = result.addChild(messageText, true);
            entry.addURLs(urls);
            result.violationCount += urls.length;
        }
    },

    freshnessLifetimeGreaterThan: function(resource, timeMs)
    {
        let dateHeader = this.responseHeader(resource, "Date");
        if (!dateHeader)
            return false;

        let dateHeaderMs = Date.parse(dateHeader);
        if (isNaN(dateHeaderMs))
            return false;

        let freshnessLifetimeMs;
        let maxAgeMatch = this.responseHeaderMatch(resource, "Cache-Control", "max-age=(\\d+)");

        if (maxAgeMatch)
            freshnessLifetimeMs = (maxAgeMatch[1]) ? 1000 * maxAgeMatch[1] : 0;
        else {
            let expiresHeader = this.responseHeader(resource, "Expires");
            if (expiresHeader) {
                let expDate = Date.parse(expiresHeader);
                if (!isNaN(expDate))
                    freshnessLifetimeMs = expDate - dateHeaderMs;
            }
        }

        return (isNaN(freshnessLifetimeMs)) ? false : freshnessLifetimeMs > timeMs;
    },

    responseHeader: function(resource, header)
    {
        return resource.responseHeaders[header];
    },

    hasResponseHeader: function(resource, header)
    {
        return resource.responseHeaders[header] !== undefined;
    },

    isCompressible: function(resource)
    {
        return WebInspector.Resource.Type.isTextType(resource.type);
    },

    isPubliclyCacheable: function(resource)
    {
        if (this._isExplicitlyNonCacheable(resource))
            return false;

        if (this.responseHeaderMatch(resource, "Cache-Control", "public"))
            return true;

        return resource.url.indexOf("?") == -1 && !this.responseHeaderMatch(resource, "Cache-Control", "private");
    },

    responseHeaderMatch: function(resource, header, regexp)
    {
        return resource.responseHeaders[header]
            ? resource.responseHeaders[header].match(new RegExp(regexp, "im"))
            : undefined;
    },

    hasExplicitExpiration: function(resource)
    {
        return this.hasResponseHeader(resource, "Date") &&
            (this.hasResponseHeader(resource, "Expires") || this.responseHeaderMatch(resource, "Cache-Control", "max-age"));
    },

    _isExplicitlyNonCacheable: function(resource)
    {
        let hasExplicitExp = this.hasExplicitExpiration(resource);
        return this.responseHeaderMatch(resource, "Cache-Control", "(no-cache|no-store|must-revalidate)") ||
            this.responseHeaderMatch(resource, "Pragma", "no-cache") ||
            (hasExplicitExp && !this.freshnessLifetimeGreaterThan(resource, 0)) ||
            (!hasExplicitExp && resource.url && resource.url.indexOf("?") >= 0) ||
            (!hasExplicitExp && !this.isCacheableResource(resource));
    },

    isCacheableResource: function(resource)
    {
        return resource.statusCode !== undefined && WebInspector.AuditRules.CacheableResponseCodes[resource.statusCode];
    }
}

WebInspector.AuditRules.CacheControlRule.prototype.__proto__ = WebInspector.AuditRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRules.CacheControlRule}
 */
WebInspector.AuditRules.BrowserCacheControlRule = function()
{
    WebInspector.AuditRules.CacheControlRule.call(this, "http-browsercache", "Leverage browser caching");
}

WebInspector.AuditRules.BrowserCacheControlRule.prototype = {
    handleNonCacheableResources: function(resources, result)
    {
        if (resources.length) {
            let entry = result.addChild("The following resources are explicitly non-cacheable. Consider making them cacheable if possible:", true);
            result.violationCount += resources.length;
            for (let i = 0; i < resources.length; ++i)
                entry.addURL(resources[i].url);
        }
    },

    runChecks: function(resources, result, callback)
    {
        this.execCheck("The following resources are missing a cache expiration. Resources that do not specify an expiration may not be cached by browsers:",
            this._missingExpirationCheck, resources, result);
        this.execCheck("The following resources specify a \"Vary\" header that disables caching in most versions of Internet Explorer:",
            this._varyCheck, resources, result);
        this.execCheck("The following cacheable resources have a short freshness lifetime:",
            this._oneMonthExpirationCheck, resources, result);

        // Unable to implement the favicon check due to the WebKit limitations.
        this.execCheck("To further improve cache hit rate, specify an expiration one year in the future for the following cacheable resources:",
            this._oneYearExpirationCheck, resources, result);
    },

    _missingExpirationCheck: function(resource)
    {
        return this.isCacheableResource(resource) && !this.hasResponseHeader(resource, "Set-Cookie") && !this.hasExplicitExpiration(resource);
    },

    _varyCheck: function(resource)
    {
        let varyHeader = this.responseHeader(resource, "Vary");
        if (varyHeader) {
            varyHeader = varyHeader.replace(/User-Agent/gi, "");
            varyHeader = varyHeader.replace(/Accept-Encoding/gi, "");
            varyHeader = varyHeader.replace(/[, ]*/g, "");
        }
        return varyHeader && varyHeader.length && this.isCacheableResource(resource) && this.freshnessLifetimeGreaterThan(resource, 0);
    },

    _oneMonthExpirationCheck: function(resource)
    {
        return this.isCacheableResource(resource) &&
            !this.hasResponseHeader(resource, "Set-Cookie") &&
            !this.freshnessLifetimeGreaterThan(resource, WebInspector.AuditRules.CacheControlRule.MillisPerMonth) &&
            this.freshnessLifetimeGreaterThan(resource, 0);
    },

    _oneYearExpirationCheck: function(resource)
    {
        return this.isCacheableResource(resource) &&
            !this.hasResponseHeader(resource, "Set-Cookie") &&
            !this.freshnessLifetimeGreaterThan(resource, 11 * WebInspector.AuditRules.CacheControlRule.MillisPerMonth) &&
            this.freshnessLifetimeGreaterThan(resource, WebInspector.AuditRules.CacheControlRule.MillisPerMonth);
    }
}

WebInspector.AuditRules.BrowserCacheControlRule.prototype.__proto__ = WebInspector.AuditRules.CacheControlRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRules.CacheControlRule}
 */
WebInspector.AuditRules.ProxyCacheControlRule = function() {
    WebInspector.AuditRules.CacheControlRule.call(this, "http-proxycache", "Leverage proxy caching");
}

WebInspector.AuditRules.ProxyCacheControlRule.prototype = {
    runChecks: function(resources, result, callback)
    {
        this.execCheck("Resources with a \"?\" in the URL are not cached by most proxy caching servers:",
            this._questionMarkCheck, resources, result);
        this.execCheck("Consider adding a \"Cache-Control: public\" header to the following resources:",
            this._publicCachingCheck, resources, result);
        this.execCheck("The following publicly cacheable resources contain a Set-Cookie header. This security vulnerability can cause cookies to be shared by multiple users.",
            this._setCookieCacheableCheck, resources, result);
    },

    _questionMarkCheck: function(resource)
    {
        return resource.url.indexOf("?") >= 0 && !this.hasResponseHeader(resource, "Set-Cookie") && this.isPubliclyCacheable(resource);
    },

    _publicCachingCheck: function(resource)
    {
        return this.isCacheableResource(resource) &&
            !this.isCompressible(resource) &&
            !this.responseHeaderMatch(resource, "Cache-Control", "public") &&
            !this.hasResponseHeader(resource, "Set-Cookie");
    },

    _setCookieCacheableCheck: function(resource)
    {
        return this.hasResponseHeader(resource, "Set-Cookie") && this.isPubliclyCacheable(resource);
    }
}

WebInspector.AuditRules.ProxyCacheControlRule.prototype.__proto__ = WebInspector.AuditRules.CacheControlRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRule}
 */
WebInspector.AuditRules.ImageDimensionsRule = function()
{
    WebInspector.AuditRule.call(this, "page-imagedims", "Specify image dimensions");
}

WebInspector.AuditRules.ImageDimensionsRule.prototype = {
    doRun: function(resources, result, callback, progressMonitor)
    {
        let urlToNoDimensionCount = {};

        function doneCallback()
        {
            for (let url in urlToNoDimensionCount) {
                let entry = entry || result.addChild("A width and height should be specified for all images in order to speed up page display. The following image(s) are missing a width and/or height:", true);
                let format = "%r";
                if (urlToNoDimensionCount[url] > 1)
                    format += " (%d uses)";
                entry.addFormatted(format, url, urlToNoDimensionCount[url]);
                result.violationCount++;
            }
            callback(entry ? result : null);
        }

        function imageStylesReady(imageId, styles, isLastStyle, computedStyle)
        {
            if (progressMonitor.canceled)
                return;

            const node = WebInspector.domAgent.nodeForId(imageId);
            let src = node.getAttribute("src");
            if (!src.asParsedURL()) {
                for (let frameOwnerCandidate = node; frameOwnerCandidate; frameOwnerCandidate = frameOwnerCandidate.parentNode) {
                    if (frameOwnerCandidate.documentURL) {
                        let completeSrc = WebInspector.completeURL(frameOwnerCandidate.documentURL, src);
                        break;
                    }
                }
            }
            if (completeSrc)
                src = completeSrc;

            if (computedStyle.getPropertyValue("position") === "absolute") {
                if (isLastStyle)
                    doneCallback();
                return;
            }

            if (styles.attributesStyle) {
                let widthFound = !!styles.attributesStyle.getLiveProperty("width");
                let heightFound = !!styles.attributesStyle.getLiveProperty("height");
            }

            let inlineStyle = styles.inlineStyle;
            if (inlineStyle) {
                if (inlineStyle.getPropertyValue("width") !== "")
                    widthFound = true;
                if (inlineStyle.getPropertyValue("height") !== "")
                    heightFound = true;
            }

            for (let i = styles.matchedCSSRules.length - 1; i >= 0 && !(widthFound && heightFound); --i) {
                let style = styles.matchedCSSRules[i].style;
                if (style.getPropertyValue("width") !== "")
                    widthFound = true;
                if (style.getPropertyValue("height") !== "")
                    heightFound = true;
            }

            if (!widthFound || !heightFound) {
                if (src in urlToNoDimensionCount)
                    ++urlToNoDimensionCount[src];
                else
                    urlToNoDimensionCount[src] = 1;
            }

            if (isLastStyle)
                doneCallback();
        }

        function getStyles(nodeIds)
        {
            if (progressMonitor.canceled)
                return;
            let targetResult = {};

            function inlineCallback(inlineStyle, attributesStyle)
            {
                targetResult.inlineStyle = inlineStyle;
                targetResult.attributesStyle = attributesStyle;
            }

            function matchedCallback(result)
            {
                if (result)
                    targetResult.matchedCSSRules = result.matchedCSSRules;
            }

            if (!nodeIds || !nodeIds.length)
                doneCallback();

            for (let i = 0; nodeIds && i < nodeIds.length; ++i) {
                WebInspector.cssModel.getMatchedStylesAsync(nodeIds[i], undefined, false, false, matchedCallback);
                WebInspector.cssModel.getInlineStylesAsync(nodeIds[i], inlineCallback);
                WebInspector.cssModel.getComputedStyleAsync(nodeIds[i], undefined, imageStylesReady.bind(null, nodeIds[i], targetResult, i === nodeIds.length - 1));
            }
        }

        function onDocumentAvailable(root)
        {
            if (progressMonitor.canceled)
                return;
            WebInspector.domAgent.querySelectorAll(root.id, "img[src]", getStyles);
        }

        if (progressMonitor.canceled)
            return;
        WebInspector.domAgent.requestDocument(onDocumentAvailable);
    }
}

WebInspector.AuditRules.ImageDimensionsRule.prototype.__proto__ = WebInspector.AuditRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRule}
 */
WebInspector.AuditRules.CssInHeadRule = function()
{
    WebInspector.AuditRule.call(this, "page-cssinhead", "Put CSS in the document head");
}

WebInspector.AuditRules.CssInHeadRule.prototype = {
    doRun: function(resources, result, callback, progressMonitor)
    {
        function evalCallback(evalResult)
        {
            if (progressMonitor.canceled)
                return;

            if (!evalResult)
                return callback(null);

            let summary = result.addChild("");

            let outputMessages = [];
            for (let url in evalResult) {
                let urlViolations = evalResult[url];
                if (urlViolations[0]) {
                    result.addFormatted("%s style block(s) in the %r body should be moved to the document head.", urlViolations[0], url);
                    result.violationCount += urlViolations[0];
                }
                for (let i = 0; i < urlViolations[1].length; ++i)
                    result.addFormatted("Link node %r should be moved to the document head in %r", urlViolations[1][i], url);
                result.violationCount += urlViolations[1].length;
            }
            summary.value = String.sprintf("CSS in the document body adversely impacts rendering performance.");
            callback(result);
        }

        function externalStylesheetsReceived(root, inlineStyleNodeIds, nodeIds)
        {
            if (progressMonitor.canceled)
                return;

            if (!nodeIds)
                return;
            let externalStylesheetNodeIds = nodeIds;
            let result = null;
            if (inlineStyleNodeIds.length || externalStylesheetNodeIds.length) {
                let urlToViolationsArray = {};
                let externalStylesheetHrefs = [];
                for (let j = 0; j < externalStylesheetNodeIds.length; ++j) {
                    let linkNode = WebInspector.domAgent.nodeForId(externalStylesheetNodeIds[j]);
                    let completeHref = WebInspector.completeURL(linkNode.ownerDocument.documentURL, linkNode.getAttribute("href"));
                    externalStylesheetHrefs.push(completeHref || "<empty>");
                }
                urlToViolationsArray[root.documentURL] = [inlineStyleNodeIds.length, externalStylesheetHrefs];
                result = urlToViolationsArray;
            }
            evalCallback(result);
        }

        function inlineStylesReceived(root, nodeIds)
        {
            if (progressMonitor.canceled)
                return;

            if (!nodeIds)
                return;
            WebInspector.domAgent.querySelectorAll(root.id, "body link[rel~='stylesheet'][href]", externalStylesheetsReceived.bind(null, root, nodeIds));
        }

        function onDocumentAvailable(root)
        {
            if (progressMonitor.canceled)
                return;

            WebInspector.domAgent.querySelectorAll(root.id, "body style", inlineStylesReceived.bind(null, root));
        }

        WebInspector.domAgent.requestDocument(onDocumentAvailable);
    }
}

WebInspector.AuditRules.CssInHeadRule.prototype.__proto__ = WebInspector.AuditRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRule}
 */
WebInspector.AuditRules.StylesScriptsOrderRule = function()
{
    WebInspector.AuditRule.call(this, "page-stylescriptorder", "Optimize the order of styles and scripts");
}

WebInspector.AuditRules.StylesScriptsOrderRule.prototype = {
    doRun: function(resources, result, callback, progressMonitor)
    {
        function evalCallback(resultValue)
        {
            if (progressMonitor.canceled)
                return;

            if (!resultValue)
                return callback(null);

            let lateCssUrls = resultValue[0];
            let cssBeforeInlineCount = resultValue[1];

            let entry = result.addChild("The following external CSS files were included after an external JavaScript file in the document head. To ensure CSS files are downloaded in parallel, always include external CSS before external JavaScript.", true);
            entry.addURLs(lateCssUrls);
            result.violationCount += lateCssUrls.length;

            if (cssBeforeInlineCount) {
                result.addChild(String.sprintf(" %d inline script block%s found in the head between an external CSS file and another resource. To allow parallel downloading, move the inline script before the external CSS file, or after the next resource.", cssBeforeInlineCount, cssBeforeInlineCount > 1 ? "s were" : " was"));
                result.violationCount += cssBeforeInlineCount;
            }
            callback(result);
        }

        function cssBeforeInlineReceived(lateStyleIds, nodeIds)
        {
            if (progressMonitor.canceled)
                return;

            if (!nodeIds)
                return;

            let cssBeforeInlineCount = nodeIds.length;
            let result = null;
            if (lateStyleIds.length || cssBeforeInlineCount) {
                let lateStyleUrls = [];
                for (let i = 0; i < lateStyleIds.length; ++i) {
                    let lateStyleNode = WebInspector.domAgent.nodeForId(lateStyleIds[i]);
                    let completeHref = WebInspector.completeURL(lateStyleNode.ownerDocument.documentURL, lateStyleNode.getAttribute("href"));
                    lateStyleUrls.push(completeHref || "<empty>");
                }
                result = [ lateStyleUrls, cssBeforeInlineCount ];
            }

            evalCallback(result);
        }

        function lateStylesReceived(root, nodeIds)
        {
            if (progressMonitor.canceled)
                return;

            if (!nodeIds)
                return;

            WebInspector.domAgent.querySelectorAll(root.id, "head link[rel~='stylesheet'][href] ~ script:not([src])", cssBeforeInlineReceived.bind(null, nodeIds));
        }

        function onDocumentAvailable(root)
        {
            if (progressMonitor.canceled)
                return;

            WebInspector.domAgent.querySelectorAll(root.id, "head script[src] ~ link[rel~='stylesheet'][href]", lateStylesReceived.bind(null, root));
        }

        WebInspector.domAgent.requestDocument(onDocumentAvailable);
    }
}

WebInspector.AuditRules.StylesScriptsOrderRule.prototype.__proto__ = WebInspector.AuditRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRule}
 */
WebInspector.AuditRules.CSSRuleBase = function(id, name)
{
    WebInspector.AuditRule.call(this, id, name);
}

WebInspector.AuditRules.CSSRuleBase.prototype = {
    doRun: function(resources, result, callback, progressMonitor)
    {
        CSSAgent.getAllStyleSheets(sheetsCallback.bind(this));

        function sheetsCallback(error, headers)
        {
            if (error)
                return callback(null);

            for (let i = 0; i < headers.length; ++i) {
                let header = headers[i];
                if (header.disabled)
                    continue; // Do not check disabled stylesheets.

                this._visitStyleSheet(header.styleSheetId, i === headers.length - 1 ? finishedCallback : null, result, progressMonitor);
            }
        }

        function finishedCallback()
        {
            callback(result);
        }
    },

    _visitStyleSheet: function(styleSheetId, callback, result, progressMonitor)
    {
        WebInspector.CSSStyleSheet.createForId(styleSheetId, sheetCallback.bind(this));

        function sheetCallback(styleSheet)
        {
            if (progressMonitor.canceled)
                return;

            if (!styleSheet) {
                if (callback)
                    callback();
                return;
            }

            this.visitStyleSheet(styleSheet, result);

            for (let i = 0; i < styleSheet.rules.length; ++i)
                this._visitRule(styleSheet, styleSheet.rules[i], result);

            this.didVisitStyleSheet(styleSheet, result);

            if (callback)
                callback();
        }
    },

    _visitRule: function(styleSheet, rule, result)
    {
        this.visitRule(styleSheet, rule, result);
        let allProperties = rule.style.allProperties;
        for (let i = 0; i < allProperties.length; ++i)
            this.visitProperty(styleSheet, allProperties[i], result);
        this.didVisitRule(styleSheet, rule, result);
    },

    visitStyleSheet: function(styleSheet, result)
    {
        // Subclasses can implement.
    },

    didVisitStyleSheet: function(styleSheet, result)
    {
        // Subclasses can implement.
    },
    
    visitRule: function(styleSheet, rule, result)
    {
        // Subclasses can implement.
    },

    didVisitRule: function(styleSheet, rule, result)
    {
        // Subclasses can implement.
    },
    
    visitProperty: function(styleSheet, property, result)
    {
        // Subclasses can implement.
    }
}

WebInspector.AuditRules.CSSRuleBase.prototype.__proto__ = WebInspector.AuditRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRules.CSSRuleBase}
 */
WebInspector.AuditRules.VendorPrefixedCSSProperties = function()
{
    WebInspector.AuditRules.CSSRuleBase.call(this, "page-vendorprefixedcss", "Use normal CSS property names instead of vendor-prefixed ones");
    this._webkitPrefix = "-webkit-";
}

WebInspector.AuditRules.VendorPrefixedCSSProperties.supportedProperties = [
    "background-clip", "background-origin", "background-size",
    "border-radius", "border-bottom-left-radius", "border-bottom-right-radius", "border-top-left-radius", "border-top-right-radius",
    "box-shadow", "box-sizing", "opacity", "text-shadow"
].keySet();

WebInspector.AuditRules.VendorPrefixedCSSProperties.prototype = {
    didVisitStyleSheet: function(styleSheet)
    {
        delete this._styleSheetResult;
    },

    visitRule: function(rule)
    {
        this._mentionedProperties = {};
    },

    didVisitRule: function()
    {
        delete this._ruleResult;
        delete this._mentionedProperties;
    },

    visitProperty: function(styleSheet, property, result)
    {
        if (property.name.indexOf(this._webkitPrefix) !== 0)
            return;

        let normalPropertyName = property.name.substring(this._webkitPrefix.length).toLowerCase(); // Start just after the "-webkit-" prefix.
        if (WebInspector.AuditRules.VendorPrefixedCSSProperties.supportedProperties[normalPropertyName] && !this._mentionedProperties[normalPropertyName]) {
            let style = property.ownerStyle;
            let liveProperty = style.getLiveProperty(normalPropertyName);
            if (liveProperty && !liveProperty.styleBased)
                return; // WebCore can provide normal versions of prefixed properties automatically, so be careful to skip only normal source-based properties.

            let rule = style.parentRule;
            this._mentionedProperties[normalPropertyName] = true;
            if (!this._styleSheetResult)
                this._styleSheetResult = result.addChild(rule.sourceURL ? WebInspector.linkifyResourceAsNode(rule.sourceURL) : "<unknown>");
            if (!this._ruleResult) {
                let anchor = WebInspector.linkifyURLAsNode(rule.sourceURL, rule.selectorText);
                anchor.preferredPanel = "resources";
                anchor.lineNumber = rule.sourceLine;
                this._ruleResult = this._styleSheetResult.addChild(anchor);
            }
            ++result.violationCount;
            this._ruleResult.addSnippet(String.sprintf("\"" + this._webkitPrefix + "%s\" is used, but \"%s\" is supported.", normalPropertyName, normalPropertyName));
        }
    }
}

WebInspector.AuditRules.VendorPrefixedCSSProperties.prototype.__proto__ = WebInspector.AuditRules.CSSRuleBase.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRule}
 */
WebInspector.AuditRules.CookieRuleBase = function(id, name)
{
    WebInspector.AuditRule.call(this, id, name);
}

WebInspector.AuditRules.CookieRuleBase.prototype = {
    doRun: function(resources, result, callback, progressMonitor)
    {
        let self = this;
        function resultCallback(receivedCookies, isAdvanced) {
            if (progressMonitor.canceled)
                return;

            self.processCookies(isAdvanced ? receivedCookies : [], resources, result);
            callback(result);
        }

        WebInspector.Cookies.getCookiesAsync(resultCallback);
    },

    mapResourceCookies: function(resourcesByDomain, allCookies, callback)
    {
        for (let i = 0; i < allCookies.length; ++i) {
            for (let resourceDomain in resourcesByDomain) {
                if (WebInspector.Cookies.cookieDomainMatchesResourceDomain(allCookies[i].domain, resourceDomain))
                    this._callbackForResourceCookiePairs(resourcesByDomain[resourceDomain], allCookies[i], callback);
            }
        }
    },

    _callbackForResourceCookiePairs: function(resources, cookie, callback)
    {
        if (!resources)
            return;
        for (let i = 0; i < resources.length; ++i) {
            if (WebInspector.Cookies.cookieMatchesResourceURL(cookie, resources[i].url))
                callback(resources[i], cookie);
        }
    }
}

WebInspector.AuditRules.CookieRuleBase.prototype.__proto__ = WebInspector.AuditRule.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRules.CookieRuleBase}
 */
WebInspector.AuditRules.CookieSizeRule = function(avgBytesThreshold)
{
    WebInspector.AuditRules.CookieRuleBase.call(this, "http-cookiesize", "Minimize cookie size");
    this._avgBytesThreshold = avgBytesThreshold;
    this._maxBytesThreshold = 1000;
}

WebInspector.AuditRules.CookieSizeRule.prototype = {
    _average: function(cookieArray)
    {
        let total = 0;
        for (let i = 0; i < cookieArray.length; ++i)
            total += cookieArray[i].size;
        return cookieArray.length ? Math.round(total / cookieArray.length) : 0;
    },

    _max: function(cookieArray)
    {
        let result = 0;
        for (let i = 0; i < cookieArray.length; ++i)
            result = Math.max(cookieArray[i].size, result);
        return result;
    },

    processCookies: function(allCookies, resources, result)
    {
        function maxSizeSorter(a, b)
        {
            return b.maxCookieSize - a.maxCookieSize;
        }

        function avgSizeSorter(a, b)
        {
            return b.avgCookieSize - a.avgCookieSize;
        }

        let cookiesPerResourceDomain = {};

        function collectorCallback(resource, cookie)
        {
            let cookies = cookiesPerResourceDomain[resource.domain];
            if (!cookies) {
                cookies = [];
                cookiesPerResourceDomain[resource.domain] = cookies;
            }
            cookies.push(cookie);
        }

        if (!allCookies.length)
            return;

        let sortedCookieSizes = [];

        let domainToResourcesMap = WebInspector.AuditRules.getDomainToResourcesMap(resources,
                null,
                true);
        let matchingResourceData = {};
        this.mapResourceCookies(domainToResourcesMap, allCookies, collectorCallback.bind(this));

        for (let resourceDomain in cookiesPerResourceDomain) {
            let cookies = cookiesPerResourceDomain[resourceDomain];
            sortedCookieSizes.push({
                domain: resourceDomain,
                avgCookieSize: this._average(cookies),
                maxCookieSize: this._max(cookies)
            });
        }
        let avgAllCookiesSize = this._average(allCookies);

        let hugeCookieDomains = [];
        sortedCookieSizes.sort(maxSizeSorter);

        for (let i = 0, len = sortedCookieSizes.length; i < len; ++i) {
            let maxCookieSize = sortedCookieSizes[i].maxCookieSize;
            if (maxCookieSize > this._maxBytesThreshold)
                hugeCookieDomains.push(WebInspector.AuditRuleResult.resourceDomain(sortedCookieSizes[i].domain) + ": " + Number.bytesToString(maxCookieSize));
        }

        let bigAvgCookieDomains = [];
        sortedCookieSizes.sort(avgSizeSorter);
        for (let i = 0, len = sortedCookieSizes.length; i < len; ++i) {
            let domain = sortedCookieSizes[i].domain;
            let avgCookieSize = sortedCookieSizes[i].avgCookieSize;
            if (avgCookieSize > this._avgBytesThreshold && avgCookieSize < this._maxBytesThreshold)
                bigAvgCookieDomains.push(WebInspector.AuditRuleResult.resourceDomain(domain) + ": " + Number.bytesToString(avgCookieSize));
        }
        result.addChild(String.sprintf("The average cookie size for all requests on this page is %s", Number.bytesToString(avgAllCookiesSize)));

        let message;
        if (hugeCookieDomains.length) {
            let entry = result.addChild("The following domains have a cookie size in excess of 1KB. This is harmful because requests with cookies larger than 1KB typically cannot fit into a single network packet.", true);
            entry.addURLs(hugeCookieDomains);
            result.violationCount += hugeCookieDomains.length;
        }

        if (bigAvgCookieDomains.length) {
            let entry = result.addChild(String.sprintf("The following domains have an average cookie size in excess of %d bytes. Reducing the size of cookies for these domains can reduce the time it takes to send requests.", this._avgBytesThreshold), true);
            entry.addURLs(bigAvgCookieDomains);
            result.violationCount += bigAvgCookieDomains.length;
        }
    }
}

WebInspector.AuditRules.CookieSizeRule.prototype.__proto__ = WebInspector.AuditRules.CookieRuleBase.prototype;

/**
 * @constructor
 * @extends {WebInspector.AuditRules.CookieRuleBase}
 */
WebInspector.AuditRules.StaticCookielessRule = function(minResources)
{
    WebInspector.AuditRules.CookieRuleBase.call(this, "http-staticcookieless", "Serve static content from a cookieless domain");
    this._minResources = minResources;
}

WebInspector.AuditRules.StaticCookielessRule.prototype = {
    processCookies: function(allCookies, resources, result)
    {
        let domainToResourcesMap = WebInspector.AuditRules.getDomainToResourcesMap(resources,
                [WebInspector.Resource.Type.Stylesheet,
                 WebInspector.Resource.Type.Image],
                true);
        let totalStaticResources = 0;
        for (let domain in domainToResourcesMap)
            totalStaticResources += domainToResourcesMap[domain].length;
        if (totalStaticResources < this._minResources)
            return;
        let matchingResourceData = {};
        this.mapResourceCookies(domainToResourcesMap, allCookies, this._collectorCallback.bind(this, matchingResourceData));

        let badUrls = [];
        let cookieBytes = 0;
        for (let url in matchingResourceData) {
            badUrls.push(url);
            cookieBytes += matchingResourceData[url]
        }
        if (badUrls.length < this._minResources)
            return;

        let entry = result.addChild(String.sprintf("%s of cookies were sent with the following static resources. Serve these static resources from a domain that does not set cookies:", Number.bytesToString(cookieBytes)), true);
        entry.addURLs(badUrls);
        result.violationCount = badUrls.length;
    },

    _collectorCallback: function(matchingResourceData, resource, cookie)
    {
        matchingResourceData[resource.url] = (matchingResourceData[resource.url] || 0) + cookie.size;
    }
}

WebInspector.AuditRules.StaticCookielessRule.prototype.__proto__ = WebInspector.AuditRules.CookieRuleBase.prototype;
