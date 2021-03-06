## Pomelo -- a fast, scalable game server framework for node.js

Pomelo is a fast, scalable game server framework for [node.js](http://nodejs.org).
It provides the basic development framework and many related components, including libraries and tools.
Pomelo is also suitable for real-time web applications; its distributed architecture makes omelo scale better than other real-time web frameworks.

[![Build Status](https://travis-ci.org/NetEase/omelo.svg?branch=master)](https://travis-ci.org/NetEase/omelo)

 * Homepage: <http://omelo.netease.com/>
 * Mailing list: <https://groups.google.com/group/omelo>
 * Documentation: <http://github.com/NetEase/omelo>
 * Wiki: <https://github.com/NetEase/omelo/wiki/>
 * Issues: <https://github.com/NetEase/omelo/issues/>
 * Tags: game, nodejs


## Features

## Install nvm
* curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash

### Complete support of game server and realtime application server architecture

* Multiple-player game: mobile, social, web, MMO rpg(middle size)
* Realtime application: chat,  message push, etc.

### Fast, scalable

* Distributed (multi-process) architecture, can be easily scale up
* Flexible server extension
* Full performance optimization and test

### Easy

* Simple API: request, response, broadcast, etc.
* Lightweight: high development efficiency based on node.js
* Convention over configuration: almost zero config

### Powerful

* Many clients support, including javascript, flash, android, iOS, cocos2d-x, C
* Many libraries and tools, including command line tool, admin tool, performance test tool, AI, path finding etc.
* Good reference materials: full docs, many examples and [an open-source MMO RPG demo](https://github.com/NetEase/omelo/wiki/Introduction-to--Lord-of-Pomelo)

### Extensible

* Support plugin architecture, easy to add new features through plugins. We also provide many plugins like online status, master high availability.
* Custom features, users can define their own network protocol, custom components very easy.

## Why should I use omelo?
Fast, scalable, real-time game server development is not an easy job, and a good container or framework can reduce its complexity.
Unfortunately, unlike web, finding a game server framework solution is difficult, especially an open source solution. Pomelo fills this gap, providing a full solution for building game server frameworks.
Pomelo has the following advantages:
* The architecture is scalable. It uses a multi-process, single thread runtime architecture, which has been proven in the industry and is especially suited to the node.js thread model.
* Easy to use, the development model is quite similar to web, using convention over configuration, with almost zero config. The [API](http://omelo.netease.com/api.html) is also easy to use.
* The framework is extensible. Based on the node.js micro module principle, the core of omelo is small. All of the components, libraries and tools are individual npm modules, and anyone can create their own module to extend the framework.
* The reference materials and documentation are quite complete. In addition to the documentation, we also provide [an open-source MMO RPG demo](https://github.com/NetEase/omelo/wiki/Introduction-to--Lord-of-Pomelo) (HTML5 client), which is a far better reference material than any book.

## How can I develop with omelo?
With the following references, you can quickly familiarize yourself with the omelo development process:
* [Pomelo documents](https://github.com/NetEase/omelo/wiki)
* [Getting started](https://github.com/NetEase/omelo/wiki/Welcome-to-Pomelo)
* [Tutorial](https://github.com/NetEase/omelo/wiki/Preface)


## Contributors
* NetEase, Inc. (@NetEase)
* Peter Johnson(@missinglink)
* Aaron Yoshitake 
* @D-Deo 
* Eduard Gotwig
* Eric Muyser(@stokegames)
* @GeforceLee
* Harold Jiang(@jzsues)
* @ETiV
* [kaisatec](https://github.com/kaisatec)
* [roytan883](https://github.com/roytan883)
* [wuxian](https://github.com/wuxian)
* [zxc122333](https://github.com/zxc122333)
* [newebug](https://github.com/newebug)
* [jiangzhuo](https://github.com/jiangzhuo)
* [youxiachai](https://github.com/youxiachai)
* [qiankanglai](https://github.com/qiankanglai)
* [xieren58](https://github.com/xieren58)
* [prim](https://github.com/prim)
* [Akaleth](https://github.com/Akaleth)
* [pipi32167](https://github.com/pipi32167)
* [ljhsai](https://github.com/ljhsai)
* [zhanghaojie](https://github.com/zhanghaojie)
* [airandfingers](https://github.com/airandfingers)

## License

(The MIT License)

Copyright (c) 2012-2017 NetEase, Inc. and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

