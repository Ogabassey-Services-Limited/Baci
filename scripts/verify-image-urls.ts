
import https from 'https';

const URLS = [
    { name: 'Samsung 83 OLED', url: 'https://image-us.samsung.com/SamsungUS/home/television-home-theater/tvs/oled-tvs/05012023/QN83S90CAFXZA_001_Front_Silver_RGB.jpg' },
    { name: 'Dell Alienware m18', url: 'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/alienware-notebooks/alienware-m18-r1/media-gallery/black/notebook-alienware-m18-r1-black-gallery-1.psd?fmt=jpg' },
    { name: 'Lenovo Legion 9i', url: 'https://p4-ofp.static.pub/ShareResource/na/products/laptops/lenovo-legion-9i-gen-8-16-intel/lenovo-legion-9i-gen-8-16-intel-gallery-1.png' },
    { name: 'HP Omen 16', url: 'https://ssl-product-images.www8-hp.com/digmedialib/prodimg/lowres/c08488358.png' }
];

async function checkUrl(item: { name: string, url: string }) {
    return new Promise((resolve) => {
        const req = https.request(item.url, { method: 'HEAD' }, (res) => {
            console.log(`[${res.statusCode}] ${item.name}`);
            resolve(res.statusCode === 200);
        });
        req.on('error', () => {
            console.log(`[ERR] ${item.name}`);
            resolve(false);
        });
        req.end();
    });
}

async function main() {
    console.log('Verifying Image URLs...');
    for (const item of URLS) {
        await checkUrl(item);
    }
}

main();
