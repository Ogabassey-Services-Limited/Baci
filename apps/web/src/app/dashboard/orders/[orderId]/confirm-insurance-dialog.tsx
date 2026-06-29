'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileUploader } from '@/components/ui/file-uploader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/lib/storage';
import type { DeviceInsuranceDetails } from '@/services/insurance';
import type { OrderDetailsItem } from '../order-items';

export type ConfirmInsurancePayload = Omit<
  DeviceInsuranceDetails,
  'customerPhoto'
> & {
  customerPhoto?: string;
};

export type ConfirmOrderPayload =
  | ConfirmInsurancePayload
  | Record<string, never>;

/** `YYYY-MM-DD` from the LOCAL calendar (not UTC), so "today"/"yesterday"
 * match the user's timezone rather than shifting across the date line. */
function toLocalDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMaxDateOfBirth() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return toLocalDateOnly(yesterday);
}

function isValidPastDateOnly(value: string, maxDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= maxDate
  );
}

interface ConfirmInsuranceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: ConfirmOrderPayload) => Promise<void>;
  orderItems: OrderDetailsItem[];
}

export default function ConfirmInsuranceDialog({
  isOpen,
  onClose,
  onConfirm,
  orderItems,
}: ConfirmInsuranceDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  // TODO: Multi-step form for complex insurance flows
  // const [step, setStep] = useState(1); // 1: Details, 2: Review/Submit

  // Form State
  const [imei, setImei] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | ''>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  // TODO: Make device color selectable from product variants
  // const [deviceColor, setDeviceColor] = useState('Black');

  // Files
  const [aboutFiles, setAboutFiles] = useState<File[]>([]);
  // const [idFiles, setIdFiles] = useState<File[]>([]); // Optional/Hidden for now

  // Check if assurance is actually needed (double check)
  const assuranceItems = orderItems.filter((item) => item.hasAssurance);

  // If no assurance items, this shouldn't really be open, but helpful for generic confirm
  const isAssuranceOrder = assuranceItems.length > 0;
  const maxDateOfBirth = getMaxDateOfBirth();

  const handleConfirm = async () => {
    if (!isAssuranceOrder) {
      setLoading(true);
      try {
        await onConfirm({});
        onClose();
      } catch (error) {
        console.error('Confirmation failed', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to confirm order. Please try again.',
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    const aboutFile = aboutFiles[0];

    // Validate required fields BEFORE any upload side-effect (no orphan uploads).
    if (!imei || !serialNumber || !aboutFile || !gender || !dateOfBirth) {
      toast({
        variant: 'destructive',
        title: 'Missing Details',
        description:
          'IMEI, Serial Number, Device Photo, Gender and Date of Birth are required for insurance.',
      });
      return;
    }
    if (!isValidPastDateOnly(dateOfBirth, maxDateOfBirth)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Date of Birth',
        description:
          'Enter a valid past date of birth before uploading the device photo.',
      });
      return;
    }

    setLoading(true);
    let objectUrl: string | null = null;
    try {
      // Create a temporary object URL to pass to our upload helper
      // (which expects a URI string and fetch-blobs it)
      objectUrl = URL.createObjectURL(aboutFile);
      const uploadedUrl = await uploadImage(objectUrl, 'images');

      if (!uploadedUrl) {
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: 'Could not upload the device photo. Please try again.',
        });
        return;
      }

      const payload: ConfirmInsurancePayload = {
        // Insurance fields
        imei,
        serialNumber,
        deviceColor: 'Black', // Default color, TODO: extract from product variant
        deviceModel: assuranceItems[0]?.name || 'Unknown Device',
        deviceMake: 'Generic', // TODO: Extract from product name
        deviceType: 'Phone' as const,
        deviceValue: assuranceItems[0]?.price || 0,
        purchaseDate: toLocalDateOnly(new Date()),
        devicePhotos: {
          about: uploadedUrl,
        },
        // Real policyholder KYC (no longer hardcoded server-side).
        gender,
        dateOfBirth,
        // Optional ID photo placeholder logic handled in service if missing
        customerPhoto: undefined,
      };

      await onConfirm(payload);
      onClose();
    } catch (error) {
      console.error('Confirmation failed', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to confirm order. Please try again.',
      });
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Order & Activate Insurance</DialogTitle>
          <DialogDescription>
            {isAssuranceOrder
              ? 'This order includes Ogabassey Assurance. Please provide device details to activate the insurance policy.'
              : 'Confirm this order for processing.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {isAssuranceOrder && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imei">IMEI Number *</Label>
                  <Input
                    id="imei"
                    placeholder="Enter IMEI 1"
                    value={imei}
                    onChange={(e) => setImei(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial">Serial Number *</Label>
                  <Input
                    id="serial"
                    placeholder="Enter Serial Number"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <select
                    id="gender"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={gender}
                    onChange={(e) =>
                      setGender(e.target.value as 'Male' | 'Female' | '')
                    }
                  >
                    <option value="">Select…</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth *</Label>
                  <Input
                    id="dob"
                    type="date"
                    max={maxDateOfBirth}
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Device "About" Screen *</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  Upload a screenshot of Settings {'>'} About Phone showing
                  IMEI/Serial.
                </div>
                <FileUploader
                  maxFiles={1}
                  onFilesSelected={setAboutFiles}
                  accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
                  className="h-32"
                />
              </div>

              {/* ID Photo Hidden for MVP - using placeholder in backend as discussed */}
              {/* 
              <div className="space-y-2">
                <Label>Customer ID (Optional)</Label>
                <FileUploader
                  maxFiles={1}
                  onFilesSelected={setIdFiles}
                  accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
                  className="h-32"
                />
              </div> 
              */}
            </>
          )}

          {!isAssuranceOrder && (
            <div className="p-4 bg-muted rounded-md text-sm">
              No additional details required for this order. Click confirm to
              proceed.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {isAssuranceOrder ? 'Confirm & Purchase Policy' : 'Confirm Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
