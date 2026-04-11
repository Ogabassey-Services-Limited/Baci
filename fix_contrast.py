with open('apps/mobile-admin/app/(auth)/verify.tsx', 'r') as f:
    content = f.read()

# Fix verify button text
content = content.replace(
"  buttonText: {\n    color: colors.text,\n    fontSize: TYPOGRAPHY.size.lg,",
"  buttonText: {\n    color: colors.textOnPrimary,\n    fontSize: TYPOGRAPHY.size.lg,")

# Fix activity indicator color inside primary button
content = content.replace(
"<ActivityIndicator color={colors.text} />",
"<ActivityIndicator color={colors.textOnPrimary} />")

# Fix checkmark color inside success background
content = content.replace(
'<Ionicons name="checkmark" size={40} color={colors.text} />',
'<Ionicons name="checkmark" size={40} color={colors.textOnPrimary} />')

# Fix comment
content = content.replace("// High contrast white button", "")

with open('apps/mobile-admin/app/(auth)/verify.tsx', 'w') as f:
    f.write(content)
