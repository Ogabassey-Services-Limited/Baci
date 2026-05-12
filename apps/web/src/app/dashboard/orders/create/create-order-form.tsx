'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  ChevronsUpDown,
  // Loader2,
  Mail,
  PlusCircle,
  Trash2,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import z from 'zod';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProductContext } from '@/contexts/product-context';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { getCountryByCode } from '@/lib/countries';
import { type Customer, customers } from '@/lib/customers';
import type { Product } from '@/lib/products';
import { cn } from '@/lib/utils';

const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.coerce
    .number()
    .min(1, { message: 'Quantity must be at least 1.' }),
});

const createOrderSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name is required.' }),
  customerEmail: z.string().email({ message: 'A valid email is required.' }),
  orderDate: z.date(),
  salesChannel: z
    .string()
    .min(1, { message: 'Please select a sales channel.' }),
  items: z
    .array(orderItemSchema)
    .min(1, { message: 'Please add at least one product to the order.' }),
  paymentStatus: z.enum(['Paid', 'Unpaid', 'Pending']),
  paymentMethod: z.enum(['Cash', 'Card', 'Bank Transfer']),
});

// Zod 4 types for react-hook-form compatibility
type CreateOrderFormInput = z.input<typeof createOrderSchema>;
type CreateOrderFormValues = z.output<typeof createOrderSchema>;

export function CreateOrderForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { products } = useProductContext();
  const { merchant } = useMerchant();
  const [isSaving, setIsSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);

  // Zod 4 + react-hook-form: specify input, context, and output types
  const form = useForm<CreateOrderFormInput, unknown, CreateOrderFormValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      orderDate: new Date(),
      salesChannel: 'Online Store',
      items: [],
      paymentStatus: 'Paid',
      paymentMethod: 'Card',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const formatCurrency = (amount: number) => {
    const country = merchant?.country
      ? getCountryByCode(merchant.country)
      : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
      !fields.some((item) => item.productId === p.id)
  );
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );
  const orderTotal = fields.reduce(
    (total, item) => total + item.price * Number(item.quantity),
    0
  );

  const addProductToOrder = (product: Product) => {
    append({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
    });
    setProductSearch('');
  };

  const selectCustomer = (customer: Customer) => {
    form.setValue('customerName', customer.name);
    form.setValue('customerEmail', customer.email);
    setCustomerPopoverOpen(false);
    setCustomerSearch('');
  };

  async function onSubmit(data: CreateOrderFormValues) {
    setIsSaving(true);
    console.log('New Order Data:', data);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSaving(false);
    toast({
      title: 'Order Created!',
      description: `A new order for ${data.customerName} has been successfully created.`,
    });
    router.push('/dashboard/orders');
  }

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-3 md:gap-8"
        >
          <div className="md:col-span-2 grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Customer & Order Details</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <Popover
                        open={customerPopoverOpen}
                        onOpenChange={setCustomerPopoverOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'w-full justify-between',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              <User className="mr-2 h-4 w-4 shrink-0" />
                              {field.value || 'Select customer'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search customers..."
                              value={customerSearch}
                              onValueChange={setCustomerSearch}
                            />
                            <CommandList>
                              <CommandEmpty>No customer found.</CommandEmpty>
                              <CommandGroup>
                                {filteredCustomers.map((customer) => (
                                  <CommandItem
                                    key={customer.id}
                                    value={customer.name}
                                    onSelect={() => selectCustomer(customer)}
                                  >
                                    {customer.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            {...field}
                            className="pl-10"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="orderDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Order Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
                              className={cn(
                                'pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            selected={field.value}
                            onSelect={field.onChange}
                            minDate={new Date('1900-01-01')}
                            maxDate={new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salesChannel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Channel</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a channel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Online Store">
                            Online Store
                          </SelectItem>
                          <SelectItem value="Instagram">Instagram</SelectItem>
                          <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                          <SelectItem value="In-person">In-person</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Products</CardTitle>
                <CardDescription>Add products to this order.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {fields.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                      <Input
                        type="number"
                        {...form.register(`items.${index}.quantity`)}
                        className="w-20 h-9 text-center"
                      />
                      <p className="font-semibold w-24 text-right">
                        {formatCurrency(item.price * Number(item.quantity))}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 h-8 w-8"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove Item</span>
                      </Button>
                    </div>
                  ))}
                </div>
                <FormField
                  control={form.control}
                  name="items"
                  render={() => (
                    <FormItem>
                      <FormMessage className="mt-2" />
                    </FormItem>
                  )}
                />

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput
                        placeholder="Search for a product..."
                        value={productSearch}
                        onValueChange={setProductSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No products found.</CommandEmpty>
                        <CommandGroup>
                          {filteredProducts.map((product) => (
                            <CommandItem
                              key={product.id}
                              onSelect={() => addProductToOrder(product)}
                              value={product.name}
                            >
                              {product.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <FormField
                  control={form.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Paid">Paid</SelectItem>
                          <SelectItem value="Unpaid">Unpaid</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Card">Card</SelectItem>
                          <SelectItem value="Bank Transfer">
                            Bank Transfer
                          </SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(orderTotal)}</span>
                </div>
                <Button
                  type="submit"
                  className="w-full mt-4"
                  disabled={isSaving}
                >
                  {isSaving && <BagLoader size={16} />}
                  Create Order
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </FormProvider>
  );
}
