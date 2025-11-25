import * as React from "react"
import PhoneInput from "react-phone-number-input"
import flags from "react-phone-number-input/flags"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import "react-phone-number-input/style.css"

const PhoneInputComponent = React.forwardRef<
    React.ElementRef<typeof PhoneInput>,
    React.ComponentPropsWithoutRef<typeof PhoneInput>
>(({ className, ...props }, ref) => {
    return (
        <PhoneInput
            ref={ref}
            className={cn(
                "flex gap-2",
                // Style the country selector to look like a Shadcn button/input
                "[&_.PhoneInputCountry]:relative [&_.PhoneInputCountry]:flex [&_.PhoneInputCountry]:items-center [&_.PhoneInputCountry]:gap-1 [&_.PhoneInputCountry]:rounded-md [&_.PhoneInputCountry]:border [&_.PhoneInputCountry]:border-input [&_.PhoneInputCountry]:bg-background [&_.PhoneInputCountry]:px-3 [&_.PhoneInputCountry]:py-2 [&_.PhoneInputCountry]:text-sm [&_.PhoneInputCountry]:ring-offset-background [&_.PhoneInputCountry]:focus-within:ring-2 [&_.PhoneInputCountry]:focus-within:ring-ring [&_.PhoneInputCountry]:focus-within:ring-offset-2",
                // Hide the default select but keep it accessible and clickable
                "[&_.PhoneInputCountrySelect]:absolute [&_.PhoneInputCountrySelect]:inset-0 [&_.PhoneInputCountrySelect]:h-full [&_.PhoneInputCountrySelect]:w-full [&_.PhoneInputCountrySelect]:opacity-0 [&_.PhoneInputCountrySelect]:cursor-pointer",
                // Style the flag icon
                "[&_.PhoneInputCountryIcon]:flex [&_.PhoneInputCountryIcon]:h-4 [&_.PhoneInputCountryIcon]:w-6 [&_.PhoneInputCountryIcon]:overflow-hidden [&_.PhoneInputCountryIcon]:rounded-sm [&_.PhoneInputCountryIcon]:object-cover",
                "[&_.PhoneInputCountryIconImg]:block [&_.PhoneInputCountryIconImg]:h-full [&_.PhoneInputCountryIconImg]:w-full",
                // Style the arrow if present (it's usually a separate element or pseudo-element, but we might not need it if we just show the flag)
                "[&_.PhoneInputCountrySelectArrow]:ml-1 [&_.PhoneInputCountrySelectArrow]:h-4 [&_.PhoneInputCountrySelectArrow]:w-4 [&_.PhoneInputCountrySelectArrow]:opacity-50",
                className
            )}
            flags={flags}
            inputComponent={Input}
            {...props}
        />
    )
})
PhoneInputComponent.displayName = "PhoneInput"

export { PhoneInputComponent as PhoneInput }
