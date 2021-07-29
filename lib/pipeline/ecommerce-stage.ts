import * as cdk from '@aws-cdk/core';
import {​​​​​​​​ ProductsFunctionStack }​​​​​​​​ from '../stacks/productsFunction-stack';
import {​​​​​​​​ ECommerceApiStack }​​​​​​​​ from '../stacks/ecommerceApi-stack';
import {​​​​​​​​ ProductsDdbStack }​​​​​​​​ from '../stacks/productsDdb-stack';

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
            "ProductsDdb", 
            {
                tags: tags,

            }
        );

        const productsFunctionStack = new ProductsFunctionStack(
            this, 
            "ProductsFunction", 
            productsDdbStack.table, 
            {
                tags: tags,
            }
        );
        
        productsFunctionStack.addDependency(productsDdbStack);

        const eCommerceApiStack = new ECommerceApiStack(
            this, 
            "ECommerceApi", 
            productsFunctionStack.handler, 
            {
                tags: tags,

            }
        );
        eCommerceApiStack.addDependency(productsFunctionStack);

        this.urlOutput = eCommerceApiStack.urlOutput;
       
    }
    
}