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
} from "@fortawesome/free-solid-svg-icons";

interface Image {
  id: string;
  responsiveImage: {
    src: string;
  };
}

interface Variation {
  id: string;
  variantImageGallery: Image[];
  variantType: {
    variation: string;
  };
}

interface ProductVariationBarcode {
  id: string;
  barcodeNumber: string;
  vintageYear: number;
  capacity: {
    capacityValue: string;
  };
  productVariant: Variation[];
}

const fetchProductByCodeSelector = (state: State) => state.fetchProductByCode;

export type ValueProps = {
  value: string;
  onReset: () => void;
};

const fetchVariations = async (barcode: string, harvestYear: string, bottleCapacity: string): Promise<Variation[]> => {
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
        productVariant {
          id
          variantImageGallery {
            responsiveImage(imgixParams: {fit: fillmax, h: "100", w: "100", q: "60", auto: format}) {
              src
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
    console.log("API Response:", data); // Log the entire response

    if (data.errors) {
      console.error("GraphQL Errors:", data.errors);
      return [];
    }

    if (!data.data || !data.data.allProductVariationBarcodes) {
      console.error("Unexpected API response structure:", data);
      return [];
    }

    // Filter the results on the client side
    const filteredVariations = data.data.allProductVariationBarcodes.filter((variation: ProductVariationBarcode) => 
      variation.vintageYear === parseInt(harvestYear) &&
      variation.capacity.capacityValue === bottleCapacity + " mL"
    );

    console.log("Filtered Variations:", filteredVariations);

    return filteredVariations[0]?.productVariant || [];
  } catch (error) {
    console.error("Error fetching variations:", error);
    return [];
  }
};

export default function Value({ value, onReset }: ValueProps) {
  const ctx = useCtx<RenderFieldExtensionCtx>();
  const [variations, setVariations] = useState<Variation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { organizationName, baseEndpoint, clientId, clientSecret } =
    normalizeConfig(ctx.plugin.attributes.parameters);

  const client = useMemo(
    () =>
      new CommerceLayerClient({
        organizationName,
        baseEndpoint,
        clientId,
        clientSecret,
      }),
    [organizationName, baseEndpoint, clientId, clientSecret]
  );

  const { product, status } = useStore(
    useCallback((state) => state.getProduct(value.split(',')[0]), [value])
  );

  const fetchProductByCode = useStore(fetchProductByCodeSelector);

  useEffect(() => {
    fetchProductByCode(client, value.split(',')[0]);
  }, [client, value, fetchProductByCode]);

  useEffect(() => {
    if (product && product.attributes.metadata) {
      const barcode = product.attributes.metadata.Barcode;
      const harvestYear = product.attributes.metadata.HarvestYear?.toString();
      const bottleCapacity = product.attributes.metadata.BottleCapacity?.split(" ")[0]; // Extract only the number

      if (barcode && harvestYear && bottleCapacity) {
        fetchVariations(barcode, harvestYear, bottleCapacity).then(setVariations);
      }
    }
  }, [product]);

  useEffect(() => {
    // Set the initial selected variation and image if they exist in the value
    const [, initialVariationId, initialImageId] = value.split(',');
    if (initialVariationId) {
      setSelectedVariation(initialVariationId);
    }
    if (initialImageId) {
      setSelectedImage(initialImageId);
    }
  }, [value]);

  const handleImageChange = (variationId: string, imageId: string) => {
    setSelectedVariation(variationId);
    setSelectedImage(imageId);
    const newValue = `${value.split(',')[0]},${variationId},${imageId}`;
    ctx.setFieldValue(ctx.fieldPath, newValue);
  };

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
        <div className={s["product"]}>
          API Error! Could not fetch details for SKU:&nbsp;
          <code>{value}</code>
        </div>
      )}
      {product && (
        <div className={s["product"]}>
          {product.attributes.image_url && (
            <div
              className={s["product__image"]}
              style={{
                backgroundImage: `url(${product.attributes.image_url})`,
              }}
            />
          )}
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
                      {price.attributes.formatted_amount} ({price.attributes.name})
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
                              [s["variation-item--selected"]]: selectedVariation === variant.id && selectedImage === image.id
                            })}
                          >
                            <input
                              type="radio"
                              name="variation"
                              value={`${variant.id},${image.id}`}
                              checked={selectedVariation === variant.id && selectedImage === image.id}
                              onChange={() => handleImageChange(variant.id, image.id)}
                              className={s["variation-radio"]}
                            />
                            <img
                              src={image.responsiveImage.src}
                              alt={`${variant.variantType.variation} - Image ${image.id}`}
                              width="50"
                              height="50"
                              className={s["variation-image"]}
                            />
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
