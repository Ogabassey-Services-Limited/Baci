import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testZeptoMail() {
    let token = process.env.ZEPTOMAIL_TOKEN || '';

    // Remove prefix if already included
    if (token.startsWith('Zoho-enczapikey ')) {
        token = token.replace('Zoho-enczapikey ', '');
    }

    console.log('Token length:', token.length);
    console.log('Token prefix:', token.substring(0, 20));

    try {
        const response = await fetch('https://api.zeptomail.com/v1.1/email', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Zoho-enczapikey ${token}`
            },
            body: JSON.stringify({
                from: { address: 'noreply@usebaci.com', name: 'Baci Test' },
                to: [{ email_address: { address: 'basseybjohn@yahoo.co.uk' } }],
                subject: 'ZeptoMail Direct Test',
                htmlbody: '<h1>Test</h1><p>This is a test from the Baci platform.</p>'
            })
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text);
    } catch (error) {
        console.error('Error:', error);
    }
}

testZeptoMail().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
