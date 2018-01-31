/*
 * Copyright (C) 2009 280 North Inc. All Rights Reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// Bottom Up Profiling shows the entire callstack backwards:
// The root node is a representation of each individual function called, and each child of that node represents
// a reverse-callstack showing how many of those calls came from it. So, unlike top-down, the statistics in
// each child still represent the root node. We have to be particularly careful of recursion with this mode
// because a root node can represent itself AND an ancestor.

WebInspector.BottomUpProfileDataGridNode = function(/*ProfileView*/ profileView, /*ProfileNode*/ profileNode, /*BottomUpProfileDataGridTree*/ owningTree)
{
    WebInspector.ProfileDataGridNode.call(this, profileView, profileNode, owningTree, this._willHaveChildren(profileNode));

    this._remainingNodeInfos = [];
}

WebInspector.BottomUpProfileDataGridNode.prototype = {
    _takePropertiesFromProfileDataGridNode: function(/*ProfileDataGridNode*/ profileDataGridNode)
    {
        this._save();

        this.selfTime = profileDataGridNode.selfTime;
        this.totalTime = profileDataGridNode.totalTime;
        this.numberOfCalls = profileDataGridNode.numberOfCalls;
    },

    // When focusing, we keep just the members of the callstack.
    _keepOnlyChild: function(/*ProfileDataGridNode*/ child)
    {
        this._save();

        this.removeChildren();
        this.appendChild(child);
    },

    _exclude: function(aCallUID)
    {
        if (this._remainingNodeInfos)
            this._populate();

        this._save();

        let children = this.children;
        let index = this.children.length;

        while (index--)
            children[index]._exclude(aCallUID);

        let child = this.childrenByCallUID[aCallUID];

        if (child)
            this._merge(child, true);
    },

    _restore: function()
    {
        WebInspector.ProfileDataGridNode.prototype._restore();

        if (!this.children.length)
            this.hasChildren = this._willHaveChildren();
    },

    _merge: function(/*ProfileDataGridNode*/ child, /*Boolean*/ shouldAbsorb)
    {
        this.selfTime -= child.selfTime;

        WebInspector.ProfileDataGridNode.prototype._merge.call(this, child, shouldAbsorb);
    },

    _sharedPopulate: function()
    {
        let remainingNodeInfos = this._remainingNodeInfos;
        let count = remainingNodeInfos.length;

        for (let index = 0; index < count; ++index) {
            let nodeInfo = remainingNodeInfos[index];
            let ancestor = nodeInfo.ancestor;
            let focusNode = nodeInfo.focusNode;
            let child = this.findChild(ancestor);

            // If we already have this child, then merge the data together.
            if (child) {
                let totalTimeAccountedFor = nodeInfo.totalTimeAccountedFor;

                child.selfTime += focusNode.selfTime;
                child.numberOfCalls += focusNode.numberOfCalls;

                if (!totalTimeAccountedFor)
                    child.totalTime += focusNode.totalTime;
            } else {
                // If not, add it as a true ancestor.
                // In heavy mode, we take our visual identity from ancestor node...
                let child = new WebInspector.BottomUpProfileDataGridNode(this.profileView, ancestor, this.tree);

                if (ancestor !== focusNode) {
                    // but the actual statistics from the "root" node (bottom of the callstack).
                    child.selfTime = focusNode.selfTime;
                    child.totalTime = focusNode.totalTime;
                    child.numberOfCalls = focusNode.numberOfCalls;
                }

                this.appendChild(child);
            }

            let parent = ancestor.parent;
            if (parent && parent.parent) {
                nodeInfo.ancestor = parent;
                child._remainingNodeInfos.push(nodeInfo);
            }
        }

        delete this._remainingNodeInfos;
    },

    _willHaveChildren: function(profileNode)
    {
        profileNode = profileNode || this.profileNode;
        // In bottom up mode, our parents are our children since we display an inverted tree.
        // However, we don't want to show the very top parent since it is redundant.
        return !!(profileNode.parent && profileNode.parent.parent);
    }
}

WebInspector.BottomUpProfileDataGridNode.prototype.__proto__ = WebInspector.ProfileDataGridNode.prototype;

WebInspector.BottomUpProfileDataGridTree = function(/*ProfileView*/ aProfileView, /*ProfileNode*/ aProfileNode)
{
    WebInspector.ProfileDataGridTree.call(this, aProfileView, aProfileNode);

    // Iterate each node in pre-order.
    let profileNodeUIDs = 0;
    let profileNodeGroups = [[], [aProfileNode]];
    let visitedProfileNodesForCallUID = {};

    this._remainingNodeInfos = [];

    for (let profileNodeGroupIndex = 0; profileNodeGroupIndex < profileNodeGroups.length; ++profileNodeGroupIndex) {
        let parentProfileNodes = profileNodeGroups[profileNodeGroupIndex];
        let profileNodes = profileNodeGroups[++profileNodeGroupIndex];
        let count = profileNodes.length;

        for (let index = 0; index < count; ++index) {
            let profileNode = profileNodes[index];

            if (!profileNode.UID)
                profileNode.UID = ++profileNodeUIDs;

            if (profileNode.head && profileNode !== profileNode.head) {
                // The total time of this ancestor is accounted for if we're in any form of recursive cycle.
                let visitedNodes = visitedProfileNodesForCallUID[profileNode.callUID];
                let totalTimeAccountedFor = false;

                if (!visitedNodes) {
                    visitedNodes = {}
                    visitedProfileNodesForCallUID[profileNode.callUID] = visitedNodes;
                } else {
                    // The total time for this node has already been accounted for iff one of it's parents has already been visited.
                    // We can do this check in this style because we are traversing the tree in pre-order.
                    let parentCount = parentProfileNodes.length;
                    for (let parentIndex = 0; parentIndex < parentCount; ++parentIndex) {
                        if (visitedNodes[parentProfileNodes[parentIndex].UID]) {
                            totalTimeAccountedFor = true;
                            break;
                        }
                    }
                }

                visitedNodes[profileNode.UID] = true;

                this._remainingNodeInfos.push({ ancestor:profileNode, focusNode:profileNode, totalTimeAccountedFor:totalTimeAccountedFor });
            }

            let children = profileNode.children;
            if (children.length) {
                profileNodeGroups.push(parentProfileNodes.concat([profileNode]))
                profileNodeGroups.push(children);
            }
        }
    }

    // Populate the top level nodes.
    WebInspector.BottomUpProfileDataGridNode.prototype._populate.call(this);

    return this;
}

WebInspector.BottomUpProfileDataGridTree.prototype = {
    // When focusing, we keep the entire callstack up to this ancestor.
    focus: function(/*ProfileDataGridNode*/ profileDataGridNode)
    {
        if (!profileDataGridNode)
            return;

        this._save();

        let currentNode = profileDataGridNode;
        let focusNode = profileDataGridNode;

        while (currentNode.parent && (currentNode instanceof WebInspector.ProfileDataGridNode)) {
            currentNode._takePropertiesFromProfileDataGridNode(profileDataGridNode);

            focusNode = currentNode;
            currentNode = currentNode.parent;

            if (currentNode instanceof WebInspector.ProfileDataGridNode)
                currentNode._keepOnlyChild(focusNode);
        }

        this.children = [focusNode];
        this.totalTime = profileDataGridNode.totalTime;
    },

    exclude: function(/*ProfileDataGridNode*/ profileDataGridNode)
    {
        if (!profileDataGridNode)
            return;

        this._save();

        let excludedCallUID = profileDataGridNode.callUID;
        let excludedTopLevelChild = this.childrenByCallUID[excludedCallUID];

        // If we have a top level node that is excluded, get rid of it completely (not keeping children),
        // since bottom up data relies entirely on the root node.
        if (excludedTopLevelChild)
            this.children.remove(excludedTopLevelChild);

        let children = this.children;
        let count = children.length;

        for (let index = 0; index < count; ++index)
            children[index]._exclude(excludedCallUID);

        if (this.lastComparator)
            this.sort(this.lastComparator, true);
    },

    _sharedPopulate: WebInspector.BottomUpProfileDataGridNode.prototype._sharedPopulate
}

WebInspector.BottomUpProfileDataGridTree.prototype.__proto__ = WebInspector.ProfileDataGridTree.prototype;

