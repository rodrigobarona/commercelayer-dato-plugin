import { useCallback, useEffect, useMemo } from "react";
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

const fetchProductByCodeSelector = (state: State) => state.fetchProductByCode;

export type ValueProps = {
  value: string;
  onReset: () => void;
};

const renderMetadata = (metadata: { [key: string]: string }) => {
  return Object.entries(metadata).map(([key, value]) => (
    <div className={s["product__producttype"]} key={key}>
      <strong>{key}:</strong> {value}
    </div>
  ));
};

export default function Value({ value, onReset }: ValueProps) {
  const ctx = useCtx<RenderFieldExtensionCtx>();

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
    useCallback((state) => state.getProduct(value), [value])
  );

  const fetchProductByCode = useStore(fetchProductByCodeSelector);

  useEffect(() => {
    fetchProductByCode(client, value);
  }, [client, value, fetchProductByCode]);

  console.log("Product:", product);

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
            {product.attributes.pieces_per_pack && (
              <div className={s["product__producttype"]}>
                <strong>Pieces per pack:</strong>
                &nbsp;
                {product.attributes.pieces_per_pack} pieces
              </div>
            )}
            {renderMetadata(product.attributes.metadata)}

            {product.pricing_list?.length > 0 && (
              <div className={s["product__producttype"]}>
                <strong>Price:</strong>{" "}
                {product.pricing_list[0].attributes.formatted_amount} (
                {product.pricing_list[0].attributes.name})
              </div>
            )}
            {product.stock_items?.length > 0 &&
              product.stock_locations?.length > 0 && (
                <div className={s["product__producttype"]}>
                  <strong>Stock:</strong>{" "}
                  {product.stock_items[0].attributes.quantity} available (
                  {
                    product.stock_locations.find(
                      (loc) =>
                        loc.id ===
                        product.stock_items[0].relationships.stock_location.data
                          .id
                    )?.attributes.name
                  }
                  )
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
