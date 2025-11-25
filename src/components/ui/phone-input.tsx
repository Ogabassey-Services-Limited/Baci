import { Check, ChevronsUpDown } from "lucide-react"
import * as React from "react"
import * as RPNInput from "react-phone-number-input"
import flags from "react-phone-number-input/flags"

import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Input, InputProps } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

type PhoneInputProps = Omit<
    React.ComponentProps<"input">,
    "onChange" | "value"
> &
    Omit<RPNInput.Props<typeof RPNInput.default>, "onChange"> & {
        onChange?: (value: RPNInput.Value) => void
    }

const PhoneInput = React.forwardRef<
    React.ElementRef<typeof RPNInput.default>,
    PhoneInputProps
>(({ className, onChange, ...props }, ref) => {
    return (
        <RPNInput.default
            ref={ref}
            className={cn("flex", className)}
            flagComponent={FlagComponent}
            countrySelectComponent={CountrySelect}
            inputComponent={InputComponent}
            /**
             * Handles the onChange event.
             *
             * react-phone-number-input might trigger the onChange event as undefined
             * when a valid phone number is not generated.
             *
             * @param value
             */
            onChange={(value) => onChange?.(value as RPNInput.Value)}
            international
            countryCallingCodeEditable={false}
            {...props}
        />
    )
})
PhoneInput.displayName = "PhoneInput"

const InputComponent = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, onChange, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            let value = e.target.value
            // Strip leading zero after country code (except for Italy +39)
            if (value.startsWith("+") && !value.startsWith("+39")) {
                // Handle space case: +234 0...
                if (value.match(/^\+\d+\s0/)) {
                    value = value.replace(/(\+\d+\s)0/, "$1")
                    e.target.value = value
                }
                // Handle no-space case: +2340...
                else if (value.match(/^\+\d+0/)) {
                    value = value.replace(/(\+\d+)0/, "$1")
                    e.target.value = value
                }
            }
            onChange?.(e)
        }

        return (
            <Input
                className={cn("rounded-e-lg rounded-s-none", className)}
                {...props}
                onChange={handleChange}
                ref={ref}
            />
        )
    }
)
InputComponent.displayName = "InputComponent"

type CountrySelectOption = { label: string; value: RPNInput.Country }

type CountrySelectProps = {
    disabled?: boolean
    value: RPNInput.Country
    onChange: (value: RPNInput.Country) => void
    options: CountrySelectOption[]
}

const CountrySelect = ({
    disabled,
    value,
    onChange,
    options,
}: CountrySelectProps) => {
    const handleSelect = React.useCallback(
        (country: RPNInput.Country) => {
            onChange(country)
        },
        [onChange]
    )

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant={"outline"}
                    className={cn("flex gap-1 rounded-e-none rounded-s-lg px-3")}
                    disabled={disabled}
                >
                    <FlagComponent country={value} countryName={value} />
                    <ChevronsUpDown
                        className={cn(
                            "-mr-2 h-4 w-4 opacity-50",
                            disabled ? "hidden" : "opacity-100"
                        )}
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandList>
                        <ScrollArea className="h-72">
                            <CommandInput placeholder="Search country..." />
                            <CommandEmpty>No country found.</CommandEmpty>
                            <CommandGroup>
                                {options
                                    .filter((x) => x.value)
                                    .map((option) => (
                                        <CommandItem
                                            className="gap-2"
                                            key={option.value}
                                            onSelect={() => handleSelect(option.value)}
                                        >
                                            <FlagComponent
                                                country={option.value}
                                                countryName={option.label}
                                            />
                                            <span className="flex-1 text-sm">{option.label}</span>
                                            {option.value && (
                                                <span className="text-foreground/50 text-sm">
                                                    {`+${RPNInput.getCountryCallingCode(option.value)}`}
                                                </span>
                                            )}
                                            <Check
                                                className={cn(
                                                    "ml-auto h-4 w-4",
                                                    option.value === value ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                        </CommandItem>
                                    ))}
                            </CommandGroup>
                        </ScrollArea>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

const FlagComponent = ({ country, countryName }: RPNInput.FlagProps) => {
    const Flag = flags[country]

    return (
        <span className="bg-foreground/20 flex h-4 w-6 overflow-hidden rounded-sm">
            {Flag && <Flag title={countryName} />}
        </span>
    )
}
FlagComponent.displayName = "FlagComponent"

export { PhoneInput }
