#!/bin/bash
echo "=== DISK SPACE SCANNER ==="
date
echo ""

measure() {
    local path="$1"
    if [ -e "$path" ]; then
        echo -n "Measuring: $path ... "
        local size=$(du -sh "$path" 2>/dev/null | cut -f1)
        if [ -n "$size" ]; then
            echo "$size"
        else
            echo "Failed"
        fi
    else
        echo "Not found: $path"
    fi
}

echo "--- Home Directory Folders ---"
measure "/Users/mac/Downloads"
measure "/Users/mac/Documents"
measure "/Users/mac/Desktop"
measure "/Users/mac/Screen Studio Projects"
measure "/Users/mac/vps-backups"

echo ""
echo "--- Workspace & Development Directories ---"
for dir in /Users/mac/Baci-app* /Users/mac/Baci-expo-sdk-56 /Users/mac/Baci-worktrees /Users/mac/worktrees; do
    measure "$dir"
done

echo ""
echo "--- Xcode & Developer Directories ---"
measure "/Users/mac/Library/Developer/Xcode/DerivedData"
measure "/Users/mac/Library/Developer/Xcode/Archives"
measure "/Users/mac/Library/Developer/Xcode/iOS DeviceSupport"
measure "/Users/mac/Library/Developer/CoreSimulator/Devices"
measure "/Users/mac/Library/Developer"

echo ""
echo "--- WhatsApp Directories ---"
measure "/Users/mac/Library/Group Containers/group.net.whatsapp.WhatsApp.shared"
measure "/Users/mac/Library/Containers/desktop.WhatsApp"
measure "/Users/mac/Library/Application Support/WhatsApp"

echo ""
echo "--- General Cache & Packagemanager Directories ---"
measure "/Users/mac/Library/Caches"
measure "/Users/mac/.npm"
measure "/Users/mac/.pnpm-store"
measure "/Users/mac/.gradle"
measure "/Users/mac/.cocoapods"
measure "/Users/mac/.docker"

echo ""
echo "=== SCAN COMPLETE ==="
