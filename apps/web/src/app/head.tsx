import 'server-only';
import * as ReactDOM from 'react-dom';

const CLOUDINARY_ORIGIN = 'https://res.cloudinary.com';

export default function Head() {
  ReactDOM.prefetchDNS(CLOUDINARY_ORIGIN);

  return null;
}
