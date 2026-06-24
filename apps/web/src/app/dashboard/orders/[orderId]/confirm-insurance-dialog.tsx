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

interface ConfirmInsuranceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: ConfirmInsurancePayload) => Promise<void>;
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

  const handleConfirm = async () => {
    // Validate required fields BEFORE any upload side-effect (no orphan uploads).
    if (isAssuranceOrder) {
      if (
        !imei ||
        !serialNumber ||
        aboutFiles.length === 0 ||
        !gender ||
        !dateOfBirth
      ) {
        toast({
          variant: 'destructive',
          title: 'Missing Details',
          description:
            'IMEI, Serial Number, Device Photo, Gender and Date of Birth are required for insurance.',
        });
        return;
      }
    }

    setLoading(true);
    try {
      let devicePhotoUrl = '';

      // Upload Logic
      if (aboutFiles.length > 0) {
        // Create a temporary object URL to pass to our upload helper
        // (which expects a URI string and fetch-blobs it)
        const objectUrl = URL.createObjectURL(aboutFiles[0]);
        const uploadedUrl = await uploadImage(objectUrl, 'images');
        URL.revokeObjectURL(objectUrl);

        if (uploadedUrl) {
          devicePhotoUrl = uploadedUrl;
        }
      }

      if (isAssuranceOrder && !devicePhotoUrl) {
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: 'Could not upload the device photo. Please try again.',
        });
        setLoading(false);
        return;
      }

      const payload = {
        // Insurance fields
        imei,
        serialNumber,
        deviceColor: 'Black', // Default color, TODO: extract from product variant
        deviceModel: assuranceItems[0]?.name || 'Unknown Device',
        deviceMake: 'Generic', // TODO: Extract from product name
        deviceType: 'Phone' as const,
        deviceValue: assuranceItems[0]?.price || 0,
        purchaseDate: new Date().toISOString().split('T')[0],
        devicePhotos: {
          about: devicePhotoUrl,
        },
        // Real policyholder KYC (no longer hardcoded server-side).
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
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
    }

    setLoading(false);
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
