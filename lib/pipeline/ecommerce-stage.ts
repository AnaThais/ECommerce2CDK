import * as cdk from "@aws-cdk/core";
import { ProductEventsFunctionStack } from '../stacks/productEventFunction-stack';
import { EventsDdbStack } from './../stacks/eventsDdb-stack';
import { ProductsFunctionStack } from "../stacks/productFunction-stack";
import { ECommerceApiStack } from "../stacks/ecommerceApi-stack";
import { ProductsDdbStack } from '../stacks/productDdb-stack';
import { OrdersApplicationStack } from "../stacks/ordersApplication-stack";

export class ECommerceStage extends cdk.Stage {
  public readonly urlOutput: cdk.CfnOutput;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const tags = {
      ["cost"]: "ECommerce",
      ["team"]: "AnaThais",
    };

    const productsDdbStack = new ProductsDdbStack(
      this,
      "ProductsDdbStack",
      {
        tags: tags,
      }
    );

    const eventsDdbStack = new EventsDdbStack(
      this,
      "EventsDdbStack",
      {
        tags: tags,
      }
    );

    const productEventsFunctionStack = new ProductEventsFunctionStack(
      this,
      "ProductEventsFunctionStack",
      productsDdbStack.table,
      {
        tags: tags,
      }
    );
    productEventsFunctionStack.addDependency(eventsDdbStack);

    const productsFunctionStack = new ProductsFunctionStack(
      this,
      "ProductsFunctionStack",
      productsDdbStack.table,
      productEventsFunctionStack.handler,
      {
        tags: tags,
      }
    );
    productsFunctionStack.addDependency(productsDdbStack);
    productsFunctionStack.addDependency(productEventsFunctionStack);

      const ordersApplicationStack = new OrdersApplicationStack(
        this,
        "OrdersApplication",
        productsDdbStack.table,
        {
        tags: tags,
      }
      );
      ordersApplicationStack.addDependency(productsDdbStack);

    const ecommerceApiStack = new ECommerceApiStack(
      this,
      "EcommerceApiStack",
      productsFunctionStack.handler,
      ordersApplicationStack.ordersHandler,
      {
        tags: tags,
      }
    );
    ecommerceApiStack.addDependency(productsFunctionStack);
    ecommerceApiStack.addDependency(ordersApplicationStack);

    this.urlOutput = ecommerceApiStack.urlOutput;
  }
}