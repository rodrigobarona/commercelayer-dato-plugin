import qs from "qs";
import { ValidConfig } from "../types";

export type Metadata = {
  [key: string]: string;
};

export type PriceList = {
  id: string;
  attributes: {
    name: string;
    formatted_amount: string;
  };
};

export type StockItem = {
  id: string;
  attributes: {
    quantity: number;
  };
  relationships: {
    stock_location: {
      data: {
        id: string;
      };
    };
  };
};

export type StockLocation = {
  id: string;
  attributes: {
    name: string;
  };
};

export type Product = {
  id: string;
  attributes: {
    image_url: string;
    name: string;
    code: string;
    description: string;
    pieces_per_pack: number;
    metadata: Metadata;
  };
  meta: {
    mode: "live" | "test";
    organization_id: string;
  };
  relationships: {
    prices: string[];
    stock_items: any[];
  };
  pricing_list: PriceList[];
  stock_items: StockItem[];
  stock_locations: StockLocation[];
};

export default class CommerceLayerClient {
  organizationName: string;
  baseEndpoint: string;
  clientId: string;
  clientSecret: string;
  token: string | null;

  constructor({
    organizationName,
    baseEndpoint,
    clientId,
    clientSecret,
  }: Pick<
    ValidConfig,
    "organizationName" | "baseEndpoint" | "clientId" | "clientSecret"
  >) {
    this.organizationName = organizationName;
    this.baseEndpoint = baseEndpoint;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.token = null;
  }

  async productPricings(sku: string): Promise<PriceList[]> {
    const result = await this.get(`/api/skus/${sku}/prices`, {
      include: 'price_list'
    });
    
    return result.data.map((price: any) => ({
      id: price.id,
      attributes: {
        formatted_amount: price.attributes.formatted_amount,
        name: result.included.find((inc: any) => 
          inc.type === 'price_lists' && inc.id === price.relationships.price_list.data.id
        )?.attributes.name || 'Unknown'
      }
    }));
  }

  async productsMatching(query: string): Promise<Product[]> {
    const result = await this.get("/api/skus", {
      "filter[q][code_or_name_or_description_cont]": query,
      "page[size]": 24,
    });

    return result.data;
  }

  async productStock(
    sku: string
  ): Promise<{ items: StockItem[]; locations: StockLocation[] }> {
    const itemsResult = await this.get(`/api/skus/${sku}/stock_items`, {
      include: "stock_location",
    });
    const items = itemsResult.data;
    const locations = itemsResult.included.filter(
      (inc: any) => inc.type === "stock_locations"
    );
    return { items, locations };
  }

  async productByCode(code: string): Promise<Product> {
    const result = await this.get("/api/skus", {
      "filter[q][code_eq]": code,
    });

    if (result.data.length === 0) {
      throw new Error("Missing SKU");
    }

    const product = result.data[0];
    product.pricing_list = await this.productPricings(product.id);
    const { items, locations } = await this.productStock(product.id);
    product.stock_items = items;
    product.stock_locations = locations;

    return product;
  }

  async getToken() {
    if (this.token) {
      return this.token;
    }

    const response = await fetch(`${this.baseEndpoint}/oauth/token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (response.status !== 200) {
      throw new Error(`Invalid status code: ${response.status}`);
    }

    const body = await response.json();

    this.token = body.access_token;

    return this.token;
  }

  async get(path: string, filters = {}) {
    const token = await this.getToken();

    const response = await fetch(
      `${this.baseEndpoint}${path}${qs.stringify(filters, {
        addQueryPrefix: true,
      })}`,
      {
        headers: {
          accept: "application/vnd.api+json",
          authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(`Invalid status code: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");

    if (!contentType || !contentType.includes("application/vnd.api+json")) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const body = await response.json();

    return body;
  }

  async updateSkuImageUrl(skuId: string, imageUrl: string): Promise<void> {
    const endpoint = `/api/skus/${skuId}`;
    const body = {
      data: {
        type: "skus",
        id: skuId,
        attributes: {
          image_url: imageUrl
        }
      }
    };

    await this.patch(endpoint, body);
  }

  async patch(path: string, body: any) {
    const token = await this.getToken();

    const response = await fetch(`${this.baseEndpoint}${path}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/vnd.api+json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (response.status !== 200) {
      throw new Error(`Invalid status code: ${response.status}`);
    }

    return response.json();
  }

  async updateSkuMetadata(skuId: string, metadata: Record<string, string>) {
    const response = await this.patch(`/api/skus/${skuId}`, {
      data: {
        type: 'skus',
        id: skuId,
        attributes: {
          metadata: metadata
        },
      },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to update SKU metadata: ${response.status}`);
    }

    return response.json();
  }
}
