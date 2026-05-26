import os
import sys
from datetime import datetime

def format_size(size_bytes):
    if size_bytes == 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB", "TB")
    i = 0
    while size_bytes >= 1024 and i < len(size_name) - 1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.2f} {size_name[i]}"

def get_dir_size_details(path):
    """
    Recursively calculates size of a directory, 
    but breaks down space used by node_modules, .worktrees, .git, and core files
    to prevent recursive loops and provide insights.
    """
    total_size = 0
    node_modules_size = 0
    worktrees_size = 0
    git_size = 0
    core_size = 0

    if not os.path.exists(path):
        return None

    try:
        for root, dirs, files in os.walk(path, topdown=True):
            # Exclude directories in-place to prevent os.walk from entering them
            # This is extremely fast and prevents loops
            
            # Check if we are in node_modules, .worktrees, or .git
            rel_path = os.path.relpath(root, path)
            parts = rel_path.split(os.sep)
            
            is_node_modules = 'node_modules' in parts
            is_worktrees = '.worktrees' in parts or 'worktrees' in parts
            is_git = '.git' in parts
            
            # Calculate file sizes
            for f in files:
                fp = os.path.join(root, f)
                try:
                    # Skip symlinks to prevent loops
                    if not os.path.islink(fp):
                        f_size = os.path.getsize(fp)
                        total_size += f_size
                        
                        if is_node_modules:
                            node_modules_size += f_size
                        elif is_worktrees:
                            worktrees_size += f_size
                        elif is_git:
                            git_size += f_size
                        else:
                            core_size += f_size
                except (OSError, PermissionError):
                    continue
                    
    except Exception as e:
        print(f"Error scanning {path}: {e}")
        
    return {
        "total": total_size,
        "node_modules": node_modules_size,
        "worktrees": worktrees_size,
        "git": git_size,
        "core": core_size
    }

def get_simple_dir_size(path):
    """Simple fast size calculator for non-development directories"""
    total_size = 0
    if not os.path.exists(path):
        return 0
    try:
        for root, dirs, files in os.walk(path):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    if not os.path.islink(fp):
                        total_size += os.path.getsize(fp)
                except (OSError, PermissionError):
                    continue
    except Exception:
        pass
    return total_size

def main():
    print("=== DEEP DISK SPACE SCANNER (PYTHON) ===")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("========================================\n")

    print("--- 1. Home Directory Folders ---")
    home_dirs = [
        ("Downloads", "/Users/mac/Downloads"),
        ("Desktop", "/Users/mac/Desktop"),
        ("Documents", "/Users/mac/Documents"),
        ("Screen Studio Projects", "/Users/mac/Screen Studio Projects"),
        ("VPS Backups", "/Users/mac/vps-backups")
    ]
    for name, path in home_dirs:
        if os.path.exists(path):
            size = get_simple_dir_size(path)
            print(f"{name}: {format_size(size)}")
        else:
            print(f"{name}: Not found")
    print("")

    print("--- 2. Workspace & Development Directories (Detailed breakdown) ---")
    workspaces = []
    # Find all Baci-app and worktree folders under /Users/mac
    try:
        for item in os.listdir("/Users/mac"):
            item_path = os.path.join("/Users/mac", item)
            if os.path.isdir(item_path) and (item.startswith("Baci-app") or "worktree" in item.lower() or item == "worktrees"):
                workspaces.append(item_path)
    except Exception as e:
        print(f"Error reading home: {e}")
        workspaces = ["/Users/mac/Baci-app"]

    for ws in sorted(workspaces):
        print(f"Scanning Workspace: {ws} ...")
        details = get_dir_size_details(ws)
        if details:
            print(f"  └─ Total Size:      {format_size(details['total'])}")
            print(f"  └─ node_modules:    {format_size(details['node_modules'])}")
            print(f"  └─ Git History:     {format_size(details['git'])}")
            print(f"  └─ Worktrees:       {format_size(details['worktrees'])}")
            print(f"  └─ Source Code:     {format_size(details['core'])}")
        else:
            print("  └─ Not found or error")
    print("")

    print("--- 3. Xcode & Developer Directories ---")
    dev_paths = [
        ("DerivedData", "/Users/mac/Library/Developer/Xcode/DerivedData"),
        ("Archives", "/Users/mac/Library/Developer/Xcode/Archives"),
        ("iOS DeviceSupport", "/Users/mac/Library/Developer/Xcode/iOS DeviceSupport"),
        ("Simulator Devices", "/Users/mac/Library/Developer/CoreSimulator/Devices"),
        ("Total Library/Developer", "/Users/mac/Library/Developer")
    ]
    for name, path in dev_paths:
        if os.path.exists(path):
            size = get_simple_dir_size(path)
            print(f"{name}: {format_size(size)}")
        else:
            print(f"{name}: Not found")
    print("")

    print("--- 4. WhatsApp Directories ---")
    whatsapp_paths = [
        ("WhatsApp Group Shared Media", "/Users/mac/Library/Group Containers/group.net.whatsapp.WhatsApp.shared"),
        ("WhatsApp App Containers (App Store)", "/Users/mac/Library/Containers/desktop.WhatsApp"),
        ("WhatsApp Desktop Support", "/Users/mac/Library/Application Support/WhatsApp")
    ]
    for name, path in whatsapp_paths:
        if os.path.exists(path):
            size = get_simple_dir_size(path)
            print(f"{name}: {format_size(size)}")
        else:
            print(f"{name}: Not found")
    print("")

    print("--- 5. General Caches & Package Managers ---")
    cache_paths = [
        ("Library Caches", "/Users/mac/Library/Caches"),
        ("npm Cache", "/Users/mac/.npm"),
        ("pnpm Store", "/Users/mac/.pnpm-store"),
        ("Gradle Cache", "/Users/mac/.gradle"),
        ("Cocoapods Cache", "/Users/mac/.cocoapods"),
        ("Docker Containers/Images", "/Users/mac/.docker")
    ]
    for name, path in cache_paths:
        if os.path.exists(path):
            size = get_simple_dir_size(path)
            print(f"{name}: {format_size(size)}")
        else:
            print(f"{name}: Not found")
    print("")
    print("=== SCAN COMPLETE ===")

if __name__ == "__main__":
    main()
