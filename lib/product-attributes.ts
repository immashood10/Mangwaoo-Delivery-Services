import type { Prisma } from '@/lib/generated/prisma/client';
import { isSizedCategory, validateSizeDetails } from '@/lib/size-options';
import { isVehicleCategory, validateVehicleDetails } from '@/lib/vehicle-details';

/**
 * The category-specific details a MangwaooMart listing must carry (Product.attributes):
 * vehicle details for Vehicles, sizes for Men / Women / Kids, nothing for other categories.
 */
export function resolveProductAttributes(
  categoryName: string,
  input: unknown
): { attributes: Prisma.InputJsonValue | undefined } | { error: string } {
  if (isVehicleCategory(categoryName)) {
    const validated = validateVehicleDetails(input);
    return 'error' in validated ? validated : { attributes: validated.details };
  }

  if (isSizedCategory(categoryName)) {
    const validated = validateSizeDetails(categoryName, input);
    return 'error' in validated ? validated : { attributes: validated.details };
  }

  return { attributes: undefined };
}
