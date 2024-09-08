import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeConfig } from "../../types";
import { useCtx } from "datocms-react-ui";
import { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import CommerceLayerClient from "../../utils/CommerceLayerClient";
import useStore, { State } from "../../utils/useStore";
import s from "./styles.module.css";
import classNames from "classnames";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExternalLinkAlt,
  faTimesCircle,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";

const fetchProductByCodeSelector = (state: State) => state.fetchProductByCode;

interface Variation {
  id: string;
  variantType: {
    variation: string;
  };
  variantImageGallery: Image[];
  referencingProductId: string;
  productNamePt: string;
  productNameEn: string;
  productNameEs: string;
}

interface Image {
  id: string;
  responsiveImage: {
    src: string;
    alt: string;
  };
}

interface ProductVariationBarcode {
  vintageYear: number;
  capacity: {
    capacityValue: string;
  };
  productVariant: Variation;
  _allReferencingProducts: {
    id: string;
    productNamePt: string;
    productNameEn: string;
    productNameEs: string;
  }[];
}

export type ValueProps = {
  value: string;
  onReset: () => void;
};

const fetchVariations = async (
  barcode: string,
  harvestYear: string,
  bottleCapacity: string
): Promise<Variation[]> => {
  const query = `
    query {
      allProductVariationBarcodes(filter: {
        barcodeNumber: { eq: "${barcode}" }
      }) {
        id
        barcodeNumber
        vintageYear
        capacity {
          capacityValue
        }
        _allReferencingProducts {
          id
          productNamePt: productName(locale: pt)
          productNameEn: productName(locale: en)
          productNameEs: productName(locale: es)
        }
        productVariant {
          id
          variantImageGallery {
            id
            responsiveImage(imgixParams: {fit: fillmax, h: "150", w: "100", q: "90", auto: format}) {
              src
              alt
            }
          }
          variantType {
            variation
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.datocms.com/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer 45fc8dc1a9f26a390d9d451ea9ee00",
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    console.log("API Response:", data);

    if (data.errors) {
      console.error("GraphQL Errors:", data.errors);
      return [];
    }

    if (!data.data || !data.data.allProductVariationBarcodes) {
      console.error("Unexpected API response structure:", data);
      return [];
    }

    const filteredVariations = data.data.allProductVariationBarcodes.filter(
      (variation: ProductVariationBarcode) =>
        variation.vintageYear === parseInt(harvestYear) &&
        variation.capacity.capacityValue === bottleCapacity + " mL"
    );

    console.log("Filtered Variations:", filteredVariations);

    if (filteredVariations.length > 0) {
      const referencingProductId = filteredVariations[0]._allReferencingProducts?.[0]?.id || '';
      const productNamePt = filteredVariations[0]._allReferencingProducts?.[0]?.productNamePt || '';
      const productNameEn = filteredVariations[0]._allReferencingProducts?.[0]?.productNameEn || '';
      const productNameEs = filteredVariations[0]._allReferencingProducts?.[0]?.productNameEs || '';
      return filteredVariations[0].productVariant.map((variant: Variation) => ({
        ...variant,
        referencingProductId,
        productNamePt,
        productNameEn,
        productNameEs
      }));
    }

    return [];
  } catch (error) {
    console.error("Error fetching variations:", error);
    return [];
  }
};

export default function Value({ value, onReset }: ValueProps) {
  const ctx = useCtx<RenderFieldExtensionCtx>();
  const client = useMemo(
    () =>
      new CommerceLayerClient(
        normalizeConfig(ctx.plugin.attributes.parameters)
      ),
    [ctx.plugin.attributes.parameters]
  );
  const [variations, setVariations] = useState<Variation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(
    null
  );
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const { organizationName } = normalizeConfig(
    ctx.plugin.attributes.parameters
  );

  const { product, status } = useStore(
    useCallback((state) => state.getProduct(value.split(",")[0]), [value])
  );

  const fetchProductByCode = useStore(fetchProductByCodeSelector);

  const handleImageChange = useCallback(
    async (variationId: string, imageId: string, imageSrc: string, referencingProductId: string, productNamePt: string, productNameEn: string, productNameEs: string) => {
      setSelectedVariation(variationId);
      setSelectedImage(imageId);
      const [sku] = value.split(",");
      const barcode = product?.attributes.metadata?.Barcode || "";
      const newValue = `${sku},${barcode},${variationId},${referencingProductId},${imageId}`;
      await ctx.setFieldValue(ctx.fieldPath, newValue);

      try {
        if (product) {
          // Update the SKU image URL
          await client.updateSkuImageUrl(product.id, imageSrc);
          console.log("SKU image_url updated successfully");

          // Update the SKU metadata
          const updatedMetadata = {
            ...product.attributes.metadata,
            productNamePt: productNamePt,
            productNameEn: productNameEn,
            productNameEs: productNameEs
          };
          await client.updateSkuMetadata(product.id, updatedMetadata);
          console.log("SKU metadata updated successfully");
        } else {
          console.error("Cannot update SKU: product is null");
        }
      } catch (error) {
        console.error("Error updating SKU:", error);
      }
    },
    [value, product, ctx, client]
  );

  useEffect(() => {
    fetchProductByCode(client, value.split(",")[0]);
  }, [client, value, fetchProductByCode]);

  useEffect(() => {
    if (product && product.attributes.metadata) {
      const barcode = product.attributes.metadata.Barcode;
      const harvestYear = product.attributes.metadata.HarvestYear?.toString();
      const bottleCapacity =
        product.attributes.metadata.BottleCapacity?.split(" ")[0];

      if (barcode && harvestYear && bottleCapacity) {
        fetchVariations(barcode, harvestYear, bottleCapacity).then(
          (fetchedVariations) => {
            setVariations(fetchedVariations);
            const [, , , , storedImageId] = value.split(",");

            if (storedImageId) {
              const variationWithStoredImage = fetchedVariations.find(
                (variation) =>
                  variation.variantImageGallery.some(
                    (image) => image.id === storedImageId
                  )
              );

              if (variationWithStoredImage) {
                const storedImage =
                  variationWithStoredImage.variantImageGallery.find(
                    (image) => image.id === storedImageId
                  );
                handleImageChange(
                  variationWithStoredImage.id,
                  storedImageId,
                  storedImage!.responsiveImage.src,
                  variationWithStoredImage.referencingProductId,
                  variationWithStoredImage.productNamePt,
                  variationWithStoredImage.productNameEn,
                  variationWithStoredImage.productNameEs
                );
                return;
              }
            }

            // If no stored image or it wasn't found, select the first variation
            if (fetchedVariations.length > 0 && !selectedVariation) {
              const firstVariation = fetchedVariations[0];
              const firstImage = firstVariation.variantImageGallery[0];
              if (firstImage) {
                handleImageChange(
                  firstVariation.id,
                  firstImage.id,
                  firstImage.responsiveImage.src,
                  firstVariation.referencingProductId,
                  firstVariation.productNamePt,
                  firstVariation.productNameEn,
                  firstVariation.productNameEs
                );
              }
            }
          }
        );
      }
    }
  }, [product, handleImageChange, selectedVariation, value]);

  useEffect(() => {
    const [, , variationId, referencingProductId, imageId] = value.split(",");
    if (variationId) {
      setSelectedVariation(variationId);
    }
    if (imageId) {
      setSelectedImage(imageId);
    }
  }, [value]);

  useEffect(() => {
    if (product) {
      const newWarnings = [];

      if (!product.attributes.metadata?.Barcode) {
        newWarnings.push(
          "Barcode is missing in the metadata. The product cannot be published."
        );
      }

      if (!product.pricing_list || product.pricing_list.length === 0) {
        newWarnings.push(
          "No price list is configured for this product. The product cannot be published."
        );
      }

      if (!product.stock_items || product.stock_items.length === 0) {
        newWarnings.push(
          "No stock information is available for this product. The product cannot be published."
        );
      }

      if (variations.length === 0) {
        newWarnings.push(
          "No variations are available for this product. The product cannot be published."
        );
      }

      setWarnings(newWarnings);
    }
  }, [product, variations]);

  const renderMetadata = (metadata: Record<string, string>) => {
    return Object.entries(metadata).map(([key, value]) => (
      <div key={key} className={s["product__producttype"]}>
        <strong>{key}:</strong> {value}
      </div>
    ));
  };

  return (
    <div
      className={classNames(s["value"], {
        [s["loading"]]: status === "loading",
      })}
    >
      {status === "error" && (
        <div className={s["error"]}>
          The SKU&nbsp;
          <code>{value.split(",")[0]}</code>&nbsp;is missing the stock
          information.
        </div>
      )}
      {warnings.length > 0 && (
        <div className={s["warnings"]}>
          {warnings.map((warning, index) => (
            <div key={index} className={s["warning"]}>
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
      {product && (
        <div className={s["product"]}>
          <div className={s["product__info"]}>
            <div className={s["product__title"]}>
              <a
                href={`https://dashboard.commercelayer.io/${product.meta.mode}/${organizationName}/apps/skus/list/${product.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {product.attributes.name}
              </a>
              <FontAwesomeIcon icon={faExternalLinkAlt} />
            </div>
            <div className={s["product__producttype"]}>
              <strong>SKU:</strong>
              &nbsp;
              {product.attributes.code}
            </div>
            {renderMetadata(product.attributes.metadata)}

            {product.pricing_list && product.pricing_list.length > 0 && (
              <div className={s["product__producttype"]}>
                <strong>Prices:</strong>
                <ul>
                  {product.pricing_list.map((price, index) => (
                    <li key={index}>
                      {price.attributes.formatted_amount} (
                      {price.attributes.name})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {product.stock_items && product.stock_items.length > 0 && (
              <div className={s["product__producttype"]}>
                <strong>Stock:</strong>
                <ul>
                  {product.stock_items.map((item, index) => {
                    const location = product.stock_locations?.find(
                      (loc) =>
                        loc.id === item.relationships.stock_location.data.id
                    );
                    return (
                      <li key={index}>
                        {item.attributes.quantity} available
                        {location && ` (${location.attributes.name})`}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {variations.length > 0 && (
              <div className={s["product__producttype"]}>
                <strong>Variations:</strong>
                <div className={s["variations-list"]}>
                  {variations.map((variant: Variation) => (
                    <div key={variant.id} className={s["variation-group"]}>
                      <h4>{variant.variantType.variation}</h4>
                      <div className={s["variation-images"]}>
                        {variant.variantImageGallery.map((image: Image) => (
                          <label
                            key={image.id}
                            className={classNames(s["variation-item"], {
                              [s["variation-item--selected"]]:
                                selectedVariation === variant.id &&
                                selectedImage === image.id,
                            })}
                          >
                            <input
                              type="radio"
                              name="variation"
                              value={`${variant.id},${image.id}`}
                              checked={
                                selectedVariation === variant.id &&
                                selectedImage === image.id
                              }
                              onChange={() =>
                                handleImageChange(
                                  variant.id,
                                  image.id,
                                  image.responsiveImage.src,
                                  variant.referencingProductId,
                                  variant.productNamePt,
                                  variant.productNameEn,
                                  variant.productNameEs
                                )
                              }
                              className={s["variation-radio"]}
                            />
                            <img
                              src={image.responsiveImage.src}
                              alt={image.responsiveImage.alt}
                              width="100"
                              height="150"
                              className={s["variation-image"]}
                            />
                            <span className={s["variation-image-tooltip"]}>
                              {image.responsiveImage.alt}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <button type="button" onClick={onReset} className={s["reset"]}>
        <FontAwesomeIcon icon={faTimesCircle} />
      </button>
    </div>
  );
}
