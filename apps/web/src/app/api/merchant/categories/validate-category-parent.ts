import { NextResponse } from 'next/server';
import {
  type CategoryRouteContext,
  categoryHasChildren,
  isParentCategoryOwnedByMerchant,
  wouldCreateCategoryCycle,
} from './category-route-support';

/**
 * Everything that must hold before a `parent_id` is written.
 *
 * Shared by POST and PATCH so the two cannot drift — they enforce the same
 * hierarchy rules: the parent belongs to this merchant, it is an active root,
 * and re-parenting neither creates a loop nor moves a branch below another
 * root. Storefront aggregation supports roots and their direct children only.
 *
 * Returns the refusal response, or null when the parent is acceptable.
 */
export async function validateCategoryParent(options: {
  supabase: CategoryRouteContext['supabase'];
  merchantId: string;
  parentId: string;
  /** The category being re-parented; omitted on create, which has no id yet. */
  categoryId?: string;
}): Promise<NextResponse | null> {
  const { supabase, merchantId, parentId, categoryId } = options;

  const ownership = await isParentCategoryOwnedByMerchant(
    supabase,
    merchantId,
    parentId
  );

  // A failed lookup is NOT absence: a non-retryable 400 PARENT_NOT_FOUND would
  // tell the client to stop retrying a parent that exists.
  if (ownership === 'lookup-failed') {
    return NextResponse.json(
      { error: 'Could not verify the parent category' },
      { status: 500 }
    );
  }
  if (ownership === 'absent') {
    return NextResponse.json(
      { error: 'Parent category not found', code: 'PARENT_NOT_FOUND' },
      { status: 400 }
    );
  }
  if (ownership === 'retired') {
    return NextResponse.json(
      {
        error: 'That parent category has been retired',
        code: 'PARENT_RETIRED',
      },
      { status: 400 }
    );
  }
  if (ownership === 'nested') {
    return NextResponse.json(
      {
        error: 'Subcategories cannot contain another category',
        code: 'PARENT_DEPTH_EXCEEDED',
      },
      { status: 400 }
    );
  }

  if (!categoryId) {
    return null;
  }

  const children = await categoryHasChildren(supabase, merchantId, categoryId);
  if (children === 'lookup-failed') {
    return NextResponse.json(
      { error: 'Could not verify the category hierarchy' },
      { status: 500 }
    );
  }
  if (children === 'has-children') {
    return NextResponse.json(
      {
        error: 'A category with subcategories cannot become a subcategory',
        code: 'CATEGORY_DEPTH_EXCEEDED',
      },
      { status: 400 }
    );
  }

  // Self-parenting is only the shortest cycle. Any ancestor loop detaches the
  // whole branch, because navigation walks down from `parent_id IS NULL` roots
  // and a looped branch has none.
  const cycle = await wouldCreateCategoryCycle(
    supabase,
    merchantId,
    categoryId,
    parentId
  );
  if (cycle === 'lookup-failed') {
    return NextResponse.json(
      { error: 'Could not verify the category hierarchy' },
      { status: 500 }
    );
  }
  if (cycle === 'cycle') {
    return NextResponse.json(
      {
        error: 'That parent would create a category loop',
        code: 'PARENT_CYCLE',
      },
      { status: 400 }
    );
  }

  return null;
}
