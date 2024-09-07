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
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

interface Variation {
  id: string;
  variantImageGallery: Array<{
    responsiveImage: {
      src: string;
    };
  }>;
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

interface Image {
  responsiveImage: {
    src: string;
  };
}

interface VariationImageCarouselProps {
  images: Image[];
  onImageChange: (imageId: string) => void;
}

const VariationImageCarousel: React.FC<VariationImageCarouselProps> = ({ images, onImageChange }) => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    adaptiveHeight: true,
    afterChange: (currentSlide: number) => {
      onImageChange(currentSlide.toString());
    }
  };

  return (
    <div className={s["variation-carousel"]}>
      <Slider {...settings}>
        {images.map((image, index) => (
          <div key={index} className={s["variation-slide"]}>
            {image?.responsiveImage?.src ? (
              <img
                src={image.responsiveImage.src}
                alt=""
                className={s["variation-image"]}
                onError={(e) => {
                  console.error(
                    "Image failed to load:",
                    image.responsiveImage.src
                  );
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className={s["variation-image-placeholder"]}>
                No image available
              </div>
            )}
          </div>
        ))}
      </Slider>
    </div>
  );
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
        productVariant {
          id
          variantImageGallery {
            responsiveImage(imgixParams: {fit: fillmax, h: "200", w: "200", q: "80", auto: format}) {
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
    const filteredVariations = data.data.allProductVariationBarcodes.filter(
      (variation: ProductVariationBarcode) =>
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  // selectedImageId is used in useEffect, so we keep it despite the warning

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
    // Set the initial selected variation if it exists in the value
    const [, initialVariationId] = value.split(",");
    if (initialVariationId) {
      setSelectedVariation(initialVariationId);
    }
  }, [value]);

  const handleVariationChange = (variationId: string) => {
    setSelectedVariation(variationId);
    setSelectedImageId(null); // Reset selected image when variation changes
    updateFieldValue(variationId);
  };

  const handleImageChange = (imageId: string, variationId: string) => {
    setSelectedImageId(imageId);
    if (selectedVariation !== variationId) {
      setSelectedVariation(variationId);
    }
    updateFieldValue(variationId, imageId);
  };

  const updateFieldValue = (variationId: string | null, imageId: string | null = null) => {
    const [sku] = value.split(",");
    const newValue = [sku, variationId, imageId].filter(Boolean).join(",");
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
                    <label
                      key={variant.id}
                      className={classNames(s["variation-item"], {
                        [s["variation-item--selected"]]:
                          selectedVariation === variant.id,
                      })}
                    >
                      <input
                        type="radio"
                        name="variation"
                        value={variant.id}
                        checked={selectedVariation === variant.id}
                        onChange={() => handleVariationChange(variant.id)}
                        className={s["variation-radio"]}
                      />
                      <VariationImageCarousel
                        images={variant.variantImageGallery}
                        onImageChange={(imageId) => handleImageChange(imageId, variant.id)}
                      />
                      <span className={s["variation-name"]}>
                        {variant.variantType.variation}
                      </span>
                    </label>
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
