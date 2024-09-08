import { RenderModalCtx } from "datocms-plugin-sdk";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Button,
  TextInput,
  Canvas,
  Spinner,
  Dropdown,
  DropdownMenu,
  DropdownOption,
  DropdownSeparator,
} from "datocms-react-ui";
import s from "./styles.module.css";
import CommerceLayerClient, { Product } from "../../utils/CommerceLayerClient";
import useStore, { State } from "../../utils/useStore";
import { normalizeConfig } from "../../types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faCaretDown,
  faCaretUp,
} from "@fortawesome/free-solid-svg-icons";
import classNames from "classnames";

const currentSearchSelector = (state: State) => state.getCurrentSearch();
const currentFetchProductsMatchingSelector = (state: State) =>
  state.fetchProductsMatching;

export default function BrowseProductsModal({ ctx }: { ctx: RenderModalCtx }) {
  const performSearch = useStore(currentFetchProductsMatchingSelector);
  const { query, status, products } = useStore(currentSearchSelector);

  const [sku, setSku] = useState<string>("");

  const { organizationName, baseEndpoint, clientId, clientSecret } =
    normalizeConfig(ctx.plugin.attributes.parameters);

  const renderMetadata = (metadata: { [key: string]: string }) => {
    return Object.entries(metadata).map(([key, value]) => {
      if (key === "Barcode") {
        return (
          <div className={s["product__title"]} key={key}>
            <strong>{key}:</strong> {value}
          </div>
        );
      } else {
        return null; // Skip rendering if the key is not "Barcode"
      }
    });
  };

  const client = useMemo(() => {
    return new CommerceLayerClient({
      organizationName,
      baseEndpoint,
      clientId,
      clientSecret,
    });
  }, [organizationName, baseEndpoint, clientId, clientSecret]);

  useEffect(() => {
    performSearch(client, query);
  }, [performSearch, query, client]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    performSearch(client, sku);
  };

  return (
    <Canvas ctx={ctx}>
      <div className={s["browse"]}>
        <form className={s["search"]} onSubmit={handleSubmit}>
          <TextInput
            placeholder="Search by Product Name or SKU... (ie. Sandeman, 20651...)"
            id="sku"
            name="sku"
            value={sku}
            onChange={setSku}
            className={s["search__input"]}
          />

          <Button
            type="submit"
            buttonType="primary"
            buttonSize="s"
            leftIcon={<FontAwesomeIcon icon={faSearch} />}
            disabled={status === "loading"}
          >
            Search
          </Button>
        </form>
        <div className={s["add__container"]}>
          <Dropdown
            renderTrigger={({ open, onClick }) => (
              <Button
                onClick={onClick}
                buttonType="negative"
                buttonSize="s"
                rightIcon={
                  open ? (
                    <FontAwesomeIcon icon={faCaretUp} />
                  ) : (
                    <FontAwesomeIcon icon={faCaretDown} />
                  )
                }
              >
                List prices
              </Button>
            )}
          >
            <DropdownMenu>
              <DropdownOption onClick={() => { }}>Reserva 1500</DropdownOption>
              <DropdownOption onClick={() => { }}>
                Empregados Sogrape Portugal
              </DropdownOption>
              <DropdownSeparator />
              <DropdownOption onClick={() => { }}>All prices</DropdownOption>
            </DropdownMenu>
          </Dropdown>
        </div>
        <div className={s["container"]}>
          <h4>All Products</h4>
          {products && (
            <div
              className={classNames(s["products"], {
                [s["products__loading"]]: status === "loading",
              })}
            >
              {products.map((product: Product) => (
                <div
                  key={product.id}
                  onClick={() => ctx.resolve(product)}
                  className={s["product"]}
                >
                  {product.attributes.image_url && (
                    <div className={s["product__image"]}>
                      <img
                        src={`${product.attributes.image_url}?auto=format&w=100&h=100&fit=crop`}
                        alt={product.attributes.code}
                      />
                    </div>
                  )}
                  <div className={s["product__content"]}>
                    <div className={s["product__code"]}>
                      {product.attributes.name}
                    </div>
                    <div className={s["product__title"]}>
                      <strong>SKU:</strong>&nbsp;{product.attributes.code}
                    </div>
                    {renderMetadata(product.attributes.metadata)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {status === "loading" && <Spinner size={25} placement="centered" />}
          {status === "success" && products && products.length === 0 && (
            <div className={s["empty"]}>No products found!</div>
          )}
          {status === "error" && (
            <div className={s["empty"]}>API call failed!</div>
          )}
        </div>
      </div>
    </Canvas>
  );
}
