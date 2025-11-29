// Script to update merchant logo in localStorage
// Run this in your browser console while on your dashboard

(function updateLogo() {
  const directImageUrl = 'https://drive.google.com/uc?export=view&id=1O9Z3Cvdx97n0GgkHdiUc4EBgdlfAuSmG';

  const userId = localStorage.getItem('userId');
  if (!userId) {
    console.error('No userId found in localStorage');
    return;
  }

  const merchantKey = `merchant_${userId}`;
  const merchantDataStr = localStorage.getItem(merchantKey);

  if (!merchantDataStr) {
    console.error('No merchant data found');
    return;
  }

  const merchantData = JSON.parse(merchantDataStr);
  merchantData.logo = directImageUrl;

  localStorage.setItem(merchantKey, JSON.stringify(merchantData));

  console.log('✅ Logo updated successfully!');
  console.log('New logo URL:', directImageUrl);
  console.log('Please refresh the page to see the changes.');
})();
