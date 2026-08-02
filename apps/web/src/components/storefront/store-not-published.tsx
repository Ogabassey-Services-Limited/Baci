import { ArrowUpRight, Sparkles, Store } from 'lucide-react';
import styles from './store-not-published.module.css';

interface StoreNotPublishedProps {
  businessName: string;
}

export function StoreNotPublished({ businessName }: StoreNotPublishedProps) {
  const storeInitial = businessName.trim().charAt(0).toUpperCase() || 'B';

  return (
    <main className={styles.page}>
      <div aria-hidden="true" className={styles.glow} />
      <section className={styles.notice}>
        <header className={styles.header}>
          <div aria-hidden="true" className={styles.monogram}>
            <span>{storeInitial}</span>
          </div>
          <div className={styles.status}>
            <span aria-hidden="true" className={styles.statusDot} />
            <span>Opening soon</span>
          </div>
        </header>

        <div className={styles.content}>
          <p className={styles.eyebrow}>
            <Sparkles aria-hidden="true" size={15} />A new shopping destination
          </p>
          <h1 className={styles.title}>{businessName}</h1>
          <p className={styles.message}>
            We&apos;re curating something worth the wait. Fresh finds,
            thoughtful details, and a brand-new storefront are almost ready for
            you.
          </p>
        </div>

        <footer className={styles.footer}>
          <div className={styles.storeMark}>
            <Store aria-hidden="true" size={18} />
            <span>Check back shortly</span>
          </div>
          <a className={styles.ownerLink} href="/login">
            Continue setting up your store
            <ArrowUpRight aria-hidden="true" size={16} />
          </a>
        </footer>
      </section>
      <p className={styles.signature}>Storefront powered by Baci</p>
    </main>
  );
}
