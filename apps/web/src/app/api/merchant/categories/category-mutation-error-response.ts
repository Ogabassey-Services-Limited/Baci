import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

type CategoryMutationOperation = 'create' | 'retire' | 'update';

export function categoryMutationErrorResponse(
  error: { code?: string; message?: string },
  operation: CategoryMutationOperation
): NextResponse {
  if (error.code === '23505') {
    return NextResponse.json(
      {
        error: 'A category with that slug already exists',
        code: 'CATEGORY_SLUG_TAKEN',
      },
      { status: 409 }
    );
  }
  if (error.message?.includes('CATEGORY_PARENT_CYCLE')) {
    return NextResponse.json(
      {
        error: 'That parent would create a category loop',
        code: 'PARENT_CYCLE',
      },
      { status: 400 }
    );
  }
  if (error.message?.includes('CATEGORY_PARENT_INVALID')) {
    return NextResponse.json(
      {
        error: 'Parent category not found or retired',
        code: 'PARENT_NOT_FOUND',
      },
      { status: 400 }
    );
  }
  if (error.message?.includes('CATEGORY_DEPTH_EXCEEDED')) {
    return NextResponse.json(
      {
        error: 'A category with subcategories cannot become a subcategory',
        code: 'CATEGORY_DEPTH_EXCEEDED',
      },
      { status: 400 }
    );
  }

  logger.error({
    message: `Category ${operation} failed`,
    code: error.code,
    error: error.message,
  });
  const messages: Record<CategoryMutationOperation, string> = {
    create: 'Could not create the category',
    retire: 'Could not retire the category',
    update: 'Could not update the category',
  };
  return NextResponse.json({ error: messages[operation] }, { status: 500 });
}
