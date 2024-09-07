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
}

interface Image {
  id: string;
  responsiveImage: {
    src: string;
    alt: string;
  };
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
  // Implement the actual fetching logic here
  // For now, we'll return an empty array
  return [];
};

export default function Value({ value, onReset }: ValueProps) {
  const ctx = useCtx<RenderFieldExtensionCtx>();
  const [variations, setVariations] = useState<Variation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

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
    useCallback((state) => state.getProduct(value.split(",")[0]), [value])
  );

  const fetchProductByCode = useStore(fetchProductByCodeSelector);

  useEffect(() => {
    fetchProductByCode(client, value.split(",")[0]);
  }, [client, value, fetchProductByCode]);

  useEffect(() => {
    if (product && product.attributes.metadata) {
      const barcode = product.attributes.metadata.Barcode;
      const harvestYear = product.attributes.metadata.HarvestYear?.toString();
      const bottleCapacity =
        product.attributes.metadata.BottleCapacity?.split(" ")[0]; // Extract only the number

      if (barcode && harvestYear && bottleCapacity) {
        fetchVariations(barcode, harvestYear, bottleCapacity).then(
          setVariations
        );
      }
    }
  }, [product]);

  useEffect(() => {
    // Set the initial selected variation and image if they exist in the value
    const [, , variationId, imageId] = value.split(',');
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
        newWarnings.push("Barcode is missing in the metadata. The product cannot be published.");
      }

      if (!product.pricing_list || product.pricing_list.length === 0) {
        newWarnings.push("No price list is configured for this product. Please add a price list before publishing.");
      }

      if (!product.stock_items || product.stock_items.length === 0) {
        newWarnings.push("No stock information is available for this product. Please add stock information before publishing.");
      }

      if (variations.length === 0) {
        newWarnings.push("No variations are available for this product. The product cannot be published or sold without variations.");
      }

      setWarnings(newWarnings);
    }
  }, [product, variations]);

  const handleImageChange = (variationId: string, imageId: string, imageSrc: string) => {
    setSelectedVariation(variationId);
    setSelectedImage(imageId);
    const [sku] = value.split(',');
    const barcode = product?.attributes.metadata?.Barcode || '';
    const cleanImageSrc = imageSrc.split('?')[0]; // Remove query parameters from the image URL
    const newValue = `${sku},${barcode},${variationId},${imageId},${cleanImageSrc}`;
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
        <div className={s["error"]}>
          API Error! Could not fetch details for SKU:&nbsp;
          <code>{value.split(',')[0]}</code>
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

            {product.pricing_list && product.pricing_list.length > 0 ? (
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
            ) : (
              <div className={s["product__producttype"]}>
                <strong>Prices:</strong> No price list available
              </div>
            )}
            
            {product.stock_items && product.stock_items.length > 0 ? (
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
            ) : (
              <div className={s["product__producttype"]}>
                <strong>Stock:</strong> No stock information available
              </div>
            )}
            
            {variations.length > 0 ? (
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
                              value={`${variant.id},${image.id},${image.responsiveImage.src.split('?')[0]}`}
                              checked={selectedVariation === variant.id && selectedImage === image.id}
                              onChange={() => handleImageChange(variant.id, image.id, image.responsiveImage.src)}
                              className={s["variation-radio"]}
                            />
                            <img
                              src={image.responsiveImage.src}
                              alt={image.responsiveImage.alt}
                              width="50"
                              height="50"
                              className={s["variation-image"]}
                            />
                            <span className={s["variation-image-alt"]}>
                              {image.responsiveImage.alt}
                            </span>
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
            ) : (
              <div className={s["product__producttype"]}>
                <strong>Variations:</strong> No variations available
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
