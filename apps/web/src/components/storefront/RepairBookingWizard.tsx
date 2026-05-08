'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  HelpCircle,
  Laptop,
  Loader2,
  MapPin,
  Smartphone,
  Tablet,
  Truck,
  Watch,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  calculateRepairShipping,
  createRepair,
  type ShippingCalculationResult,
} from '@/app/actions/repair';
import {
  AddressAutocomplete,
  type PlaceDetails,
} from '@/components/address-autocomplete';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  type RepairBookingInput,
  repairBookingSchema,
} from '@/lib/validations/repair';

interface RepairBookingWizardProps {
  merchantId: string;
  merchantName: string;
}

const steps = [
  { id: 'device', title: 'Device Details' },
  { id: 'contact', title: 'Contact Info' },
  { id: 'review', title: 'Review & Submit' },
];

const deviceTypes = [
  { id: 'Smartphone', icon: Smartphone, label: 'Smartphone' },
  { id: 'Laptop', icon: Laptop, label: 'Laptop' },
  { id: 'Tablet', icon: Tablet, label: 'Tablet' },
  { id: 'Console', icon: Gamepad2, label: 'Console' },
  { id: 'Smartwatch', icon: Watch, label: 'Smartwatch' },
  { id: 'Other', icon: HelpCircle, label: 'Other' },
];

export function RepairBookingWizard({
  merchantId,
  merchantName,
}: RepairBookingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shippingQuote, setShippingQuote] =
    useState<ShippingCalculationResult | null>(null);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const { toast } = useToast();

  const form = useForm<
    z.input<typeof repairBookingSchema>,
    unknown,
    RepairBookingInput
  >({
    resolver: zodResolver(repairBookingSchema),
    defaultValues: {
      deviceType: 'Smartphone',
      deviceModel: '',
      issueDescription: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      serviceType: 'dropoff',
      pickupAddress: '',
    },
    mode: 'onTouched',
  });

  const { trigger, watch } = form;
  const formData = watch();

  const nextStep = async () => {
    let fieldsToValidate: (keyof RepairBookingInput)[] = [];
    if (currentStep === 0) {
      fieldsToValidate = ['deviceType', 'deviceModel', 'issueDescription'];
    } else if (currentStep === 1) {
      fieldsToValidate = [
        'customerName',
        'customerEmail',
        'customerPhone',
        'preferredDate',
      ];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleAddressSelect = async (place: PlaceDetails) => {
    // Update form value
    form.setValue('pickupAddress', place.formattedAddress);

    // Calculate shipping
    setIsCalculatingShipping(true);
    setShippingQuote(null);
    try {
      const result = await calculateRepairShipping(place);
      setShippingQuote(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsCalculatingShipping(false);
    }
  };

  const onSubmit = async (data: RepairBookingInput) => {
    setIsSubmitting(true);
    try {
      const result = await createRepair(data, merchantId);
      if (result.success) {
        setIsSuccess(true);
        toast({
          title: 'Request Submitted',
          description:
            'We have received your repair request. We will contact you shortly.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Submission Failed',
          description: result.error,
        });
      }
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto text-center py-12 px-4"
      >
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
        <p className="text-muted-foreground mb-8">
          Thanks for booking a repair with {merchantName}. Your ticket number
          will be sent to your email. We'll be in touch shortly to confirm the
          details.
        </p>
        <Button asChild>
          <Link href="/">Back to Store</Link>
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                'text-sm font-medium transition-colors',
                index <= currentStep ? '' : 'text-muted-foreground'
              )}
              style={
                index <= currentStep
                  ? { color: 'var(--theme-primary, #dc2626)' }
                  : undefined
              }
            >
              {step.title}
            </div>
          ))}
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full"
            style={{ backgroundColor: 'var(--theme-primary, #dc2626)' }}
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* biome-ignore lint/suspicious/noExplicitAny: Workaround for react-hook-form/zod generic mismatch */}
      <Form {...(form as any)}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <AnimatePresence mode="wait">
            {currentStep === 0 && (
              <motion.div
                key="step-0"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="deviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">
                          What device needs repair?
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-2 sm:grid-cols-3 gap-4"
                          >
                            {deviceTypes.map((type) => (
                              <FormItem key={type.id}>
                                <FormControl>
                                  <RadioGroupItem
                                    value={type.id}
                                    className="peer sr-only"
                                  />
                                </FormControl>
                                <FormLabel className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                                  <type.icon className="mb-3 h-6 w-6" />
                                  {type.label}
                                </FormLabel>
                              </FormItem>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deviceModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Device Model</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. iPhone 13 Pro Max"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="issueDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What's the issue?</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Please describe the problem (e.g. Broken screen, Battery not charging)"
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            defaultCountry="NG"
                            placeholder="Enter phone number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Service Type Selection */}
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">
                        How would you like to proceed?
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-2 gap-4"
                        >
                          <FormItem>
                            <FormControl>
                              <RadioGroupItem
                                value="dropoff"
                                className="peer sr-only"
                              />
                            </FormControl>
                            <FormLabel
                              className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-current [&:has([data-state=checked])]:border-current cursor-pointer transition-all"
                              style={{
                                borderColor:
                                  field.value === 'dropoff'
                                    ? 'var(--theme-primary, #dc2626)'
                                    : undefined,
                              }}
                            >
                              <MapPin className="mb-2 h-6 w-6" />
                              <span className="font-medium">Drop-off</span>
                              <span className="text-xs text-muted-foreground text-center">
                                I'll bring it to you
                              </span>
                            </FormLabel>
                          </FormItem>
                          <FormItem>
                            <FormControl>
                              <RadioGroupItem
                                value="pickup"
                                className="peer sr-only"
                              />
                            </FormControl>
                            <FormLabel
                              className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-current [&:has([data-state=checked])]:border-current cursor-pointer transition-all"
                              style={{
                                borderColor:
                                  field.value === 'pickup'
                                    ? 'var(--theme-primary, #dc2626)'
                                    : undefined,
                              }}
                            >
                              <Truck className="mb-2 h-6 w-6" />
                              <span className="font-medium">Pickup</span>
                              <span className="text-xs text-muted-foreground text-center">
                                Pick up from me
                              </span>
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pickup Address - Shown only when pickup is selected */}
                {formData.serviceType === 'pickup' && (
                  <FormField
                    control={form.control}
                    name="pickupAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pickup Address</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            value={field.value}
                            onChange={field.onChange}
                            onSelect={handleAddressSelect}
                            placeholder="Enter your address"
                            country="ng"
                            showIcon
                          />
                        </FormControl>
                        {isCalculatingShipping && (
                          <div className="flex items-center text-sm text-muted-foreground mt-2">
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />{' '}
                            Calculating pickup fee...
                          </div>
                        )}
                        {shippingQuote && !isCalculatingShipping && (
                          <div
                            className={cn(
                              'flex items-center text-sm font-medium mt-2 p-2 rounded-md border',
                              shippingQuote.isFree
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            )}
                          >
                            {shippingQuote.isFree ? (
                              <CheckCircle className="w-4 h-4 mr-2" />
                            ) : (
                              <Truck className="w-4 h-4 mr-2" />
                            )}
                            {shippingQuote.message ||
                              shippingQuote.formattedPrice}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="preferredDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Date (Optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="datetime-local"
                            {...field}
                            min={new Date().toISOString().slice(0, 16)}
                          />
                          <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Summary
                  </h3>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Device</p>
                      <p className="font-medium">
                        {formData.deviceType} - {formData.deviceModel}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Issue</p>
                      <p className="font-medium">{formData.issueDescription}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Contact</p>
                      <p className="font-medium">{formData.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formData.customerPhone}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">
                        {formData.preferredDate
                          ? new Date(
                              formData.preferredDate
                            ).toLocaleDateString()
                          : 'As soon as possible'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Service Method</p>
                      <div className="flex justify-between items-center">
                        <p className="font-medium capitalize flex items-center">
                          {formData.serviceType}
                          {formData.serviceType === 'pickup' &&
                            formData.pickupAddress && (
                              <span className="text-xs text-muted-foreground ml-2 truncate max-w-[200px] block">
                                ({formData.pickupAddress})
                              </span>
                            )}
                        </p>
                        {formData.serviceType === 'pickup' && shippingQuote && (
                          <span
                            className={cn(
                              'text-sm font-bold px-2 py-0.5 rounded',
                              shippingQuote.isFree
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            )}
                          >
                            {shippingQuote.formattedPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 text-blue-800 p-4 rounded-md flex gap-3 items-start text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>
                    Submitting this request does not guarantee an appointment
                    slot. The merchant will review and confirm availability.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0 || isSubmitting}
              className={currentStep === 0 ? 'invisible' : ''}
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> Back
            </Button>

            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={nextStep}
                className="inline-flex items-center px-6 py-2.5 rounded-md font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--theme-primary, #dc2626)' }}
              >
                Next <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-6 py-2.5 rounded-md font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--theme-primary, #dc2626)' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />{' '}
                    Submitting...
                  </>
                ) : (
                  'Book Appointment'
                )}
              </button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
