"""
ComfyUI Auto Group Bypasser
Finds all groups and creates bypass toggles
"""

class GroupBypasserNode:
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "trigger": ("*",),
            }
        }
    
    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("trigger",)
    FUNCTION = "execute"
    CATEGORY = "utils"
    OUTPUT_NODE = True
    
    def execute(self, trigger=None):
        # The actual bypass logic is handled by JavaScript
        print(f"Group Bypasser: Executing")
        return (trigger,)


NODE_CLASS_MAPPINGS = {
    "GroupBypasserNode": GroupBypasserNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "GroupBypasserNode": "Group Bypasser 🎯",
}

WEB_DIRECTORY = "./web"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']