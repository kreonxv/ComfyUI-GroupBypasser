import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "GroupBypasser",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "GroupBypasserNode") {
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const result = onNodeCreated?.apply(this, arguments);
                
                this.groupStates = new Map();
                
                // Add widgets for each group
                this.updateGroupWidgets = function() {
                    // Remove old group widgets (keep first 2 which are default)
                    const baseWidgets = this.widgets?.length || 0;
                    while (this.widgets && this.widgets.length > 0) {
                        if (this.widgets[this.widgets.length - 1].isGroupToggle) {
                            this.widgets.pop();
                        } else {
                            break;
                        }
                    }
                    
                    const graph = app.graph;
                    if (!graph) {
                        console.log("No graph available");
                        return;
                    }
                    
                    const groups = graph._groups || [];
                    
                    if (groups.length === 0) {
                        console.log("No groups found in workflow");
                        return;
                    }
                    
                    console.log(`Found ${groups.length} groups`);
                    
                    // Sort groups by vertical position (topmost first)
                    const sortedGroups = [...groups].sort((a, b) => {
                        const aY = (a.bounding || a._bounding || [])[1] || 0;
                        const bY = (b.bounding || b._bounding || [])[1] || 0;
                        return aY - bY;
                    });
                    
                    // Add toggle for each group
                    sortedGroups.forEach((group) => {
                        // Check current state of nodes in group
                        const nodesInGroup = this.getNodesInGroup(group);
                        const allEnabled = nodesInGroup.every(n => n.mode === 0 || n.mode === undefined);
                        
                        const widget = this.addWidget(
                            "toggle",
                            group.title || "Unnamed Group",
                            allEnabled,
                            (value) => {
                                console.log(`Toggle ${group.title}: ${value}`);
                                this.toggleGroup(group, value);
                            }
                        );
                        widget.isGroupToggle = true;
                    });
                    
                    this.setSize(this.computeSize());
                    this.setDirtyCanvas(true, true);
                };
                
                // Get all nodes in a group
                this.getNodesInGroup = function(group) {
                    const graph = app.graph;
                    const nodes = graph._nodes || [];
                    const nodesInGroup = [];
                    
                    // Use ComfyUI's built-in method if available
                    if (group.recomputeInsideNodes) {
                        group.recomputeInsideNodes();
                    }
                    
                    const [gx, gy, gw, gh] = group.bounding || group._bounding || [0, 0, 0, 0];
                    
                    nodes.forEach(node => {
                        if (!node.pos || !node.size) return;
                        
                        const [nx, ny] = node.pos;
                        const [nw, nh] = node.size;
                        
                        // Check if node is inside group bounds
                        const centerX = nx + nw / 2;
                        const centerY = ny + nh / 2;
                        
                        const isInside = centerX >= gx && centerX <= (gx + gw) &&
                                       centerY >= gy && centerY <= (gy + gh);
                        
                        if (isInside) {
                            nodesInGroup.push(node);
                        }
                    });
                    
                    return nodesInGroup;
                };
                
                // Toggle bypass state for all nodes in a group
                this.toggleGroup = function(group, enable) {
                    const nodesInGroup = this.getNodesInGroup(group);
                    
                    console.log(`${enable ? 'Enabling' : 'Bypassing'} ${nodesInGroup.length} nodes in group "${group.title}"`);
                    
                    nodesInGroup.forEach(node => {
                        // Mode values: 0 = ALWAYS (enabled), 2 = NEVER (muted), 4 = BYPASS
                        if (enable) {
                            node.mode = 0; // ALWAYS - execute normally
                        } else {
                            node.mode = 4; // BYPASS - skip execution
                        }
                    });
                    
                    app.graph.setDirtyCanvas(true, true);
                };
                
                // Add bypass all button
                this.addWidget("button", "⏭️ Bypass All Groups", null, () => {
                    const graph = app.graph;
                    const groups = graph._groups || [];
                    groups.forEach(group => {
                        this.toggleGroup(group, false);
                    });
                    // Update toggle states
                    this.updateGroupWidgets();
                });
                
                // Add enable all button
                this.addWidget("button", "▶️ Enable All Groups", null, () => {
                    const graph = app.graph;
                    const groups = graph._groups || [];
                    groups.forEach(group => {
                        this.toggleGroup(group, true);
                    });
                    // Update toggle states
                    this.updateGroupWidgets();
                });
                
                // Initial update after a short delay
                setTimeout(() => {
                    console.log("Initial group widgets update...");
                    this.updateGroupWidgets();
                }, 500);
                
                // Setup automatic refresh on graph changes
                this.setupAutoRefresh = function() {
                    const graph = app.graph;
                    if (!graph) return;
                    
                    // Track group count and properties
                    this.lastGroupCount = 0;
                    this.lastGroupData = new Map();
                    
                    // Monitor for changes
                    this.checkForChanges = () => {
                        const groups = graph._groups || [];
                        let needsRefresh = false;
                        
                        // Check if group count changed
                        if (groups.length !== this.lastGroupCount) {
                            console.log("Group count changed, auto-refreshing...");
                            needsRefresh = true;
                            this.lastGroupCount = groups.length;
                        }
                        
                        // Check if group properties changed (title, bounding)
                        groups.forEach((group, idx) => {
                            const groupKey = `${idx}`;
                            const currentData = JSON.stringify({
                                title: group.title,
                                bounding: group.bounding || group._bounding
                            });
                            
                            if (this.lastGroupData.get(groupKey) !== currentData) {
                                needsRefresh = true;
                                this.lastGroupData.set(groupKey, currentData);
                            }
                        });
                        
                        if (needsRefresh) {
                            this.updateGroupWidgets();
                        }
                    };
                    
                    // Check for changes periodically
                    this.autoRefreshInterval = setInterval(() => {
                        this.checkForChanges();
                    }, 1000); // Check every second
                    
                    // Also check on specific graph events
                    const originalOnConfigure = graph.onConfigure;
                    graph.onConfigure = function(data) {
                        const result = originalOnConfigure?.apply(this, arguments);
                        setTimeout(() => {
                            const node = graph._nodes.find(n => n.type === "GroupBypasserNode");
                            if (node && node.checkForChanges) {
                                node.checkForChanges();
                            }
                        }, 100);
                        return result;
                    };
                };
                
                // Start auto-refresh
                this.setupAutoRefresh();
                
                // Cleanup on node removal
                const originalOnRemoved = this.onRemoved;
                this.onRemoved = function() {
                    if (this.autoRefreshInterval) {
                        clearInterval(this.autoRefreshInterval);
                    }
                    originalOnRemoved?.apply(this, arguments);
                };
                
                return result;
            };
        }
    }
});