import * as cdk from '@aws-cdk/core';
import {​​​​​​​​ ProductsFunctionStack }​​​​​​​​ from '../stack/productsFunction-stack';


export class ECommerceStage extends cdk.Stage {
    public readonly urlOutput: cdk.CfnOutput;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const productsFunctionStack = new ProductsFunctionStack(this, "ProductsFunction", {
            tags: {
            ["cost"]: "ECommerce2CDK",
            ["team"]: "AnaThais",
            },
        })
       
    }
    



}