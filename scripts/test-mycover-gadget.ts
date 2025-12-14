/**
 * MyCover Gadget Insurance API Test Script
 * 
 * Purpose: Test if id_image_url is truly required or can be omitted/placeholder
 * 
 * Run with: npx tsx scripts/test-mycover-gadget.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const MYCOVER_BASE_URL = 'https://api.mycover.ai/v1';


interface GadgetInsuranceParams {
    // Customer details
    date_of_birth: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    gender: 'Male' | 'Female';
    address: string;
    occupation: string;
    title: string;

    // Device details
    model_number: string;
    device_type: 'Phone' | 'Laptop' | 'Others';
    device_make: string;
    device_model: string;
    device_color: string;
    imei_one: string;
    imei_two?: string;
    date_of_purchase: string;
    device_value: number;
    device_serial_number: string;

    // Images
    id_image_url?: string;
    device_about_image_url: string;
}

async function testGadgetInsurance() {
    const secretKey = process.env.MYCOVER_SECRET_KEY;

    if (!secretKey) {
        console.error('❌ MYCOVER_SECRET_KEY not found in environment');
        process.exit(1);
    }

    console.log('🔑 MyCover Secret Key found');
    console.log('📡 Testing Gadget Insurance API...\n');

    // Test payload with minimal/placeholder id_image_url
    const testPayload: GadgetInsuranceParams = {
        // Customer (test data)
        date_of_birth: '1990-01-15',
        first_name: 'Test',
        last_name: 'Customer',
        email: 'test@ogabassey.com',
        phone_number: '08012345678',
        gender: 'Male',
        address: 'Test Address, Lagos',
        occupation: 'Engineer',
        title: 'Mr',

        // Device (test data)
        model_number: 'TEST123',
        device_type: 'Phone',
        device_make: 'Samsung',
        device_model: 'Galaxy A50',
        device_color: 'Black',
        imei_one: '123456789012345',
        date_of_purchase: '2024-01-01',
        device_value: 150000, // ₦150,000
        device_serial_number: 'TESTSERIAL123',

        // Images - using placeholder
        device_about_image_url: 'https://via.placeholder.com/300x300?text=Device+About',
        // id_image_url intentionally omitted to test if required
    };

    console.log('📋 Test 1: WITHOUT id_image_url field');
    console.log('   Payload:', JSON.stringify(testPayload, null, 2).slice(0, 500) + '...\n');

    try {
        const response = await fetch(`${MYCOVER_BASE_URL}/products/sti/buy-gadget-cover`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPayload),
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ SUCCESS! Policy created WITHOUT id_image_url');
            console.log('   Response:', JSON.stringify(data, null, 2));
        } else {
            console.log('❌ FAILED:', response.status);
            console.log('   Error:', JSON.stringify(data, null, 2));

            // Check if error is specifically about id_image_url
            const errorText = JSON.stringify(data).toLowerCase();
            if (errorText.includes('id_image') || errorText.includes('id image')) {
                console.log('\n⚠️  The error is specifically about id_image_url - IT IS REQUIRED');
            } else {
                console.log('\n⚠️  Error is about something else, not id_image_url');
            }
        }
    } catch (error) {
        console.error('❌ Network/Request Error:', error);
    }

    // Test 2: With placeholder id_image_url
    console.log('\n---\n');
    console.log('📋 Test 2: WITH placeholder id_image_url');

    const testPayloadWithId = {
        ...testPayload,
        id_image_url: 'https://via.placeholder.com/300x300?text=ID+Placeholder',
    };

    try {
        const response = await fetch(`${MYCOVER_BASE_URL}/products/sti/buy-gadget-cover`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPayloadWithId),
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ SUCCESS! Policy created WITH placeholder id_image_url');
            console.log('   Response:', JSON.stringify(data, null, 2));
        } else {
            console.log('❌ FAILED:', response.status);
            console.log('   Error:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('❌ Network/Request Error:', error);
    }
}

testGadgetInsurance();
