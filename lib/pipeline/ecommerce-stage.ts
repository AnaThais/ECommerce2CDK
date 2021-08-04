import * as cdk from "@aws-cdk/core";
import { ProductEventsFunctionStack } from '../stacks/productEventsFunction-stack';
import { EventsDdbStack } from './../stacks/eventsDdb-stack';
import { ProductsFunctionStack } from "../stacks/productFunction-stack";
import { ECommerceApiStack } from "../stacks/ecommerceApi-stack";
import { ProductsDdbStack } from '../stacks/productDdb-stack';
import { OrdersApplicationStack } from "../stacks/ordersApplication-stack";
import { ProductEventsFetchsFunctionStack } from "../stacks/productEventsFetchFunction-stack";


export class ECommerceStage extends cdk.Stage {
  public readonly urlOutput: cdk.CfnOutput;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const tags = {
      ["cost"]: "ECommerce",
      ["team"]: "AnaThais",
    };

    const productsDdbStack = new ProductsDdbStack(this, "ProductsDdb", {
      tags: tags,
    });

    const eventsDdbStack = new EventsDdbStack(this, "EventsDdb", {
      tags: tags,
    });

    const productEventsFunctionStack = new ProductEventsFunctionStack(
      this,
      "ProductEventsFunction",
      eventsDdbStack.table,
      {
        tags: tags,
      }
    );
    productEventsFunctionStack.addDependency(eventsDdbStack);

    const productsFunctionStack = new ProductsFunctionStack(
      this,
      "ProductsFunction",
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
      eventsDdbStack.table,
      {
        tags: tags,
      }
    );
    ordersApplicationStack.addDependency(productsDdbStack);
    ordersApplicationStack.addDependency(eventsDdbStack);

    const productEventsFetchsFunctionStack =
      new ProductEventsFetchsFunctionStack(
        this,
        "ProductEventsFetchsFunction",
        eventsDdbStack.table
      );
    productEventsFetchsFunctionStack.addDependency(eventsDdbStack);

    const eCommerceApiStack = new ECommerceApiStack(
      this,
      "ECommerceApi",
      productsFunctionStack.handler,
      ordersApplicationStack.ordersHandler,
      productEventsFetchsFunctionStack.handler,
      {
        tags: tags,
      }
    );
    eCommerceApiStack.addDependency(productsFunctionStack);
    eCommerceApiStack.addDependency(ordersApplicationStack);
    eCommerceApiStack.addDependency(productEventsFetchsFunctionStack);

    this.urlOutput = eCommerceApiStack.urlOutput;
  }
}