
import { type NextRequest, NextResponse } from 'next/server';
import { getGiglPrice } from '@/lib/gigl';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // This is a simplified payload. In a real app, you'd get station IDs
        // and proper locations. For now, we use example data.
        const giglPayload = {
            "SenderStationId": 39,
            "ReceiverStationId": 10,
            "VehicleType": 1, // Bike
            "ReceiverLocation": {
                "Latitude": body.receiverLatitude || 9.0570,
                "Longitude": body.receiverLongitude || 7.4950
            },
            "SenderLocation": {
                "Latitude": 6.649438,
                "Longitude": 3.340983
            },
            "IsFromAgility": false,
            "CustomerCode": "ECO017121", // This would be dynamic
            "CustomerType": 0, // Individual
            "DeliveryOptionIds": [2], // Home Delivery
            "Value": body.cartValue || 1000,
            "PickUpOptions": 1,
            "ShipmentItems": body.items.map((item: {name: string, quantity: number, weight: number, value: number}) => ({
                "ItemName": item.name,
                "Description": item.name,
                "SpecialPackageId": 0,
                "Quantity": item.quantity,
                "Weight": item.weight || 1, // Default weight if not provided
                "IsVolumetric": false,
                "Length": 0,
                "Width": 0,
                "Height": 0,
                "ShipmentType": 1, // Regular
                "Value": item.value
            }))
        };

        const result = await getGiglPrice(giglPayload);

        if (result.status !== 200) {
            throw new Error(result.message || 'Failed to get shipping quote from GIGL.');
        }

        return NextResponse.json({
            shippingFee: result.data.GrandTotal,
            provider: 'GIGL',
            details: result.data,
        });

    } catch (error) {
        return NextResponse.json(
            { error: 'Internal server error', details: (error as Error).message },
            { status: 500 }
        );
    }
}
