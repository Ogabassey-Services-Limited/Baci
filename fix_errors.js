const fs = require('fs');

// apps/web/src/app/api/orders/[id]/cancelled/route.ts
const cancelledPath = 'apps/web/src/app/api/orders/[id]/cancelled/route.ts';
let cancelledContent = fs.readFileSync(cancelledPath, 'utf8');
cancelledContent = cancelledContent.replace(
  /if \(insertTxError\) {\s*logger\.error\(\{\s*message: 'Failed to create refund transaction record',\s*error: insertTxError,\s*orderId: id,\s*\}\);\s*}/g,
  `if (insertTxError) {
            logger.error({
              message: 'Failed to create refund transaction record',
              error: insertTxError,
              orderId: id,
            });
            // We should still return the refund success but indicate transaction logging failed,
            // or perhaps return an error. Given the webhook context, we might just log it,
            // but Warden philosophy says don't fail silently. Let's return a 500 if the transaction fails.
            return NextResponse.json(
              { error: 'Refund processed but failed to create transaction record' },
              { status: 500 }
            );
          }`
);
fs.writeFileSync(cancelledPath, cancelledContent);

// apps/web/src/app/api/storefront/loyalty/enroll/route.ts
const enrollPath = 'apps/web/src/app/api/storefront/loyalty/enroll/route.ts';
let enrollContent = fs.readFileSync(enrollPath, 'utf8');
enrollContent = enrollContent.replace(
  /if \(referrerTxError\) {\s*console\.error\('Error recording referrer points transaction:', referrerTxError\);\s*}/g,
  `if (referrerTxError) {
          console.error('Error recording referrer points transaction:', referrerTxError);
          // Return an error response instead of failing silently
          return NextResponse.json(
            { error: 'Failed to record referrer points transaction' },
            { status: 500 }
          );
        }`
);
fs.writeFileSync(enrollPath, enrollContent);


// apps/web/src/app/api/storefront/loyalty/redeem/route.ts
const redeemPath = 'apps/web/src/app/api/storefront/loyalty/redeem/route.ts';
let redeemContent = fs.readFileSync(redeemPath, 'utf8');
redeemContent = redeemContent.replace(
  /if \(insertTxError\) {\s*console\.error\('Error recording points transaction:', insertTxError\);\s*}/g,
  `if (insertTxError) {
      console.error('Error recording points transaction:', insertTxError);
      return NextResponse.json(
        { error: 'Failed to record points transaction' },
        { status: 500 }
      );
    }`
);
fs.writeFileSync(redeemPath, redeemContent);

// apps/web/src/app/api/vtu/loyalty/redeem/route.ts
const vtuRedeemPath = 'apps/web/src/app/api/vtu/loyalty/redeem/route.ts';
let vtuRedeemContent = fs.readFileSync(vtuRedeemPath, 'utf8');
vtuRedeemContent = vtuRedeemContent.replace(
  /if \(insertTxError\) {\s*console\.error\('Error logging loyalty transaction:', insertTxError\);\s*}/g,
  `if (insertTxError) {
      console.error('Error logging loyalty transaction:', insertTxError);
      return NextResponse.json(
        { error: 'Failed to log loyalty transaction' },
        { status: 500 }
      );
    }`
);
fs.writeFileSync(vtuRedeemPath, vtuRedeemContent);

console.log('Fixes applied');
