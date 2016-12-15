var url = require('url');
var path = require('path');
var querystring = require('querystring');
var syncrequest = require('syncrequest');

/**
 * ��������http����
 * �������Ҫ�����ҳ�����������Ӧ���ݽ����޸�(���������ľ�̬��Դ���б��ش���)
 * @param {Object} ���ò�������
 */
module.exports = function(config) {
    return function*(next) {
        var requestUrl = this.request.url;
        var urlObj = url.parse(requestUrl);
        var queryObj = querystring.parse(urlObj.query);

        var debugPageHosts = config.debugPageHosts; //debugҳ���hosts����
        var isAssignHost = isBelongAssignHost(config.debugPageHosts, urlObj.host);
        var isOpenDebug = queryObj.debug === 'true' || queryObj.debug === '1';
        if (this.method === 'GET' && isAssignHost && isOpenDebug) {
            var nonDebugUrl = requestUrl.slice(0, requestUrl.lastIndexOf('debug'));
            var result = syncrequest.get.sync(nonDebugUrl);
            var pageContent = result.body;
            //������CSS�Ĵ���
            if (config.cssProxy) {
                pageContent = replaceLinkTag(config, pageContent);
            }
            //������JS�Ĵ���
            if (config.jsProxy) {
                pageContent = replaceScriptTag(config, pageContent);
            }

            this.body = pageContent;
            return;
        }
        yield next;
    };
};


/**
 * �ж�����Host�Ƿ�����ָ��Host(������ͬ����)
 * @param  {Array} ָ��Host�б�
 * @param  {String}����Host
 * @return {Boolean} true:����ָ��Host��false:������ָ��Host
 */
function isBelongAssignHost(debugPageHosts, requestHost) {
    var isBelongs = false;
    debugPageHosts.forEach(function(host) {
        if (~requestHost.indexOf(host)) {
            isBelongs = true;
        }
    });
    return isBelongs;
}


/**
 * �滻Link��ǩ
 * @param  {String} ���ò�������
 * @param  {String} ҳ������
 * @return {String} ������ҳ������
 */
function replaceLinkTag(config, content) {
    var linkTagRegExp = /<link[^>]*?href\s*=\s*(['"])([^"']*?)(['"])[^>]*?\/?>/gi;
    content = content.replace(linkTagRegExp, function(linkTag) {
        return generateNewLinkTag(config, linkTag, linkTagRegExp);
    });

    return content;
}


/**
 * �����µ�link��ǩ
 * @param  {String} ���ò�������
 * @param  {String} �������link��ǩ
 * @param  {Object} ƥ��link��ǩ��������ʽ
 * @return {String} �µ�link��ǩ
 */
function generateNewLinkTag(config, linkTag, linkTagRegExp) {
    var newLinkTag;
    var isSupportCombo = config.combo;
    var comboUrlSplit = config.comboUrlSplit;
    var comboQuerySplit = config.comboQuerySplit;
    var stylesheetRegExp = /rel\s*=\s*['"]stylesheet['"]\s*/gi;
    var cssUrlUniqueSubstr = config.cssUrlUniqueSubstr; //cssUrl��ͷ����
    var newLineChar = '\r\n'; //���з�

    if (!stylesheetRegExp.test(linkTag)) { //����ʽ���linkԭ������
        newLinkTag = linkTag;
    } else {
        var cssUrl = linkTag.replace(linkTagRegExp, '$2');

        //·���Ƿ���Ҫ����
        if (~cssUrl.indexOf(cssUrlUniqueSubstr)) {
            //�Ƿ�֧��Combo
            if (isSupportCombo) {
                //combo�����Դ
                if (cssUrl.indexOf(comboUrlSplit) && cssUrl.split(comboQuerySplit).length > 1) {
                    var urlStore = splitComboUrl(config, cssUrl, "URL_FROM_LINK");
                    var linkStore = urlStore.map(function(url) {
                        return _generateLinkTag(url);
                    });
                    newLinkTag = linkStore.join(newLineChar) + newLineChar;
                } else {
                    cssUrl = generateNewUrl(config, cssUrl);
                    newLinkTag = _generateLinkTag(cssUrl);
                }
            } else {
                cssUrl = generateNewUrl(config, cssUrl);
                newLinkTag = _generateLinkTag(cssUrl);
            }
        } else {
            newLinkTag = linkTag;
        }
    }

    return newLinkTag;
}


/**
 * �滻Script��ǩ
 * @param  {Object} ���ò�������
 * @param  {String} ҳ������
 * @return {String} ������ҳ������
 */
function replaceScriptTag(config, content) {
    var scriptTagRegExp = /<script[^>]*?src=(['"])([^"']*?)(['"])[^>]*?>\s*<\s*\/script\s*>/gi;

    content = content.replace(scriptTagRegExp, function(scriptTag) {
        return generateNewScriptTag(config, scriptTag, scriptTagRegExp);
    });

    return content;
}


/**
 * �����µ�script��ǩ
 * @param  {Object} ���ò�������
 * @param  {String} �������script��ǩ
 * @param  {Object} ƥ��script��ǩ��������ʽ
 * @return {String} �µ�script��ǩ
 */
function generateNewScriptTag(config, scriptTag, scriptTagRegExp) {
    var newScriptTag;
    var isSupportCombo = config.combo;
    var comboUrlSplit = config.comboUrlSplit;
    var comboQuerySplit = config.comboQuerySplit;
    var jsUrlUniqueSubstr = config.jsUrlUniqueSubstr; //jsUrl��ͷ����
    var newLineChar = '\r\n'; //���з�

    var jsUrl = scriptTag.replace(scriptTagRegExp, '$2');

    //·���Ƿ���Ҫ����
    if (~jsUrl.indexOf(jsUrlUniqueSubstr)) {
        //�Ƿ�֧��Combo
        if (isSupportCombo) {
            //combo�����Դ
            if (jsUrl.indexOf(comboUrlSplit) && jsUrl.split(comboQuerySplit).length > 1) {
                var urlStore = splitComboUrl(config, jsUrl, "URL_FROM_SCRIPT");
                var scriptStore = urlStore.map(function(url) {
                    return _generateScriptTag(url);
                });
                newScriptTag = scriptStore.join(newLineChar) + newLineChar;
            } else {
                jsUrl = generateNewUrl(config, jsUrl);
                newScriptTag = _generateScriptTag(jsUrl);
            }
        } else {
            jsUrl = generateNewUrl(config, jsUrl);
            newScriptTag = _generateScriptTag(jsUrl);
        }
    } else {
        newScriptTag = scriptTag;
    }

    return newScriptTag;
}


/**
 * �滻������(��combo)��cssUrl�������µ�cssUrl
 * @param  {Object} ���ò�������
 * @param  {String} ԭʼcssUrl
 * @param  {String} url���ͣ�"URL_FROM_LINK":����link��ǩ��"URL_FROM_SCRIPT"����script��ǩ
 * @return {String} �滻���cssUrl
 */
function generateNewUrl(config, singleUrl, urlType) {
    var localServerHost = '//127.0.0.1:' + config.staticServerPort + '/';
    var mountFolder; //�����ļ���
    if (urlType === "URL_FROM_LINK") {
        mountFolder = config.cssMountFolder; //css���صı����ļ���
    } else {
        mountFolder = config.jsMountFolder; //js���صı����ļ���
    }

    singleUrl = singleUrl.slice(singleUrl.lastIndexOf(mountFolder + '/'));
    singleUrl = singleUrl.replace(/(\?.*$)|(.min)/g, ''); //ȥ".min"��"?v=201612141858"
    singleUrl = localServerHost + singleUrl;

    return singleUrl;
}


/**
 * ���comboUrl�������CDN
 * @param  {Object} ���ò�������
 * @param  {String} comboUrl
 * @param  {String} url���ͣ�"URL_FROM_LINK":����link��ǩ��"URL_FROM_SCRIPT"����script��ǩ
 * @return {Array} url���ɵı�ǩ����
 */
function splitComboUrl(config, comboUrl, urlType) {
    var urlStore = []; //���Ϊ�����URL����ʽ[{"url":"xxx/xxx","requireProxy":true},{"url":"xxx/xxx","requireProxy":false}]
    var newUrlStore = []; //��Ŵ������URL
    var comboUrlSplit = config.comboUrlSplit;
    var comboQuerySplit = config.comboQuerySplit;
    var localServerHost = '//127.0.0.1:' + config.staticServerPort + '/';
    var comboUrlSplitIndex = comboUrl.indexOf(comboUrlSplit);
    var comboUrlHost = comboUrl.slice(0, comboUrlSplitIndex);
    var comboUrlQuery = comboUrl.slice(comboUrlSplitIndex + 2);

    var mountFolder; //�����ļ���
    var urlUniqueSubstr; //url��ͷ����
    if (urlType === "URL_FROM_LINK") {
        mountFolder = config.cssMountFolder; //css���صı����ļ���
        urlUniqueSubstr = config.cssUrlUniqueSubstr; //cssUrl��ͷ����
    } else {
        mountFolder = config.jsMountFolder; //js���صı����ļ���
        urlUniqueSubstr = config.jsUrlUniqueSubstr; //jsUrl��ͷ����
    }

    comboUrlQuery.split(comboQuerySplit).forEach(function(singleUrl) {
        var urlObj = {};
        if (~singleUrl.indexOf(urlUniqueSubstr)) {
            urlObj.requireProxy = true;
            singleUrl = singleUrl.slice(singleUrl.lastIndexOf(mountFolder + '/'));
            singleUrl = singleUrl.replace(/(\?.*$)|(.min)/g, ''); //ȥ".min"��"?v=201612141858"
        } else {
            urlObj.requireProxy = false;
        }
        urlObj.url = singleUrl;
        urlStore.push(urlObj);
    });

    //����������Ҫ�������Դ����combo
    var urlCacheArray = []; //������Ų���Ҫ�����Url������ж�������combo
    urlStore.forEach(function(urlObj, index) {
        if (urlObj.requireProxy) {
            if (urlCacheArray.length > 0) {
                newUrlStore.push(comboUrlHost + comboUrlSplit + urlCacheArray.join(comboQuerySplit));
                urlCacheArray = [];
            }
            newUrlStore.push(localServerHost + urlObj.url);
        } else {
            urlCacheArray.push(urlObj.url);
            //������һ���ǲ���Ҫ����ģ����ֶ�����
            if (index === urlStore.length - 1) {
                if (urlCacheArray.length > 0) {
                    newUrlStore.push(comboUrlHost + comboUrlSplit + urlCacheArray.join(comboQuerySplit));
                    urlCacheArray = [];
                }
            }
        }
    });

    return newUrlStore;
}


/**
 * ����link��ǩ
 * @param  {String} url
 * @return {String} ���ɵ�link��ǩ
 */
function _generateLinkTag(url) {
    return '<link rel="stylesheet" href="' + url + '">';
}


/**
 * ����script��ǩ
 * @param  {String} url
 * @return {String} ���ɵ�script��ǩ
 */
function _generateScriptTag(url) {
    return '<script src="' + url + '"></script>';
}
