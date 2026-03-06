const PAGE_SIZE = 20;
const SEARCH_PAGE_SIZE = 25;

export function getCustomerPageSize(search?: string) {
  return search?.trim() ? SEARCH_PAGE_SIZE : PAGE_SIZE;
}
