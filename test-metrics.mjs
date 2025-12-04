// Quick test script to verify the server action
import { getLandingMetrics } from './src/app/actions';

async function test() {
    try {
        console.log('Testing getLandingMetrics...');
        const metrics = await getLandingMetrics();
        console.log('Metrics:', JSON.stringify(metrics, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
