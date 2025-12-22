[**nextn**](../../../../README.md)

***

[nextn](../../../../README.md) / [components/themed/themed-sheet](../README.md) / ThemedSheetContent

# Variable: ThemedSheetContent

> `const` **ThemedSheetContent**: `ForwardRefExoticComponent`\<`Omit`\<`SheetContentProps` & `RefAttributes`\<`HTMLDivElement`\>, `"ref"`\> & `RefAttributes`\<`HTMLDivElement`\>\>

Defined in: [src/components/themed/themed-sheet.tsx:23](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/components/themed/themed-sheet.tsx#L23)

ThemedSheetContent - A wrapper for SheetContent that applies merchant brand colors

Since Sheet components render as portals outside the normal DOM hierarchy,
they don't inherit CSS variables from AppBody. This wrapper ensures the 
--store-* CSS variables are available for ThemedButton and other themed components.

## Example

```ts
<Sheet>
  <SheetTrigger>Open</SheetTrigger>
  <ThemedSheetContent>
    <ThemedButton colorRole="primary">Button with correct colors</ThemedButton>
  </ThemedSheetContent>
</Sheet>
```
