export type PlbsData = {
	salesWithTax: number;
	salesWithoutTax: number;
	principal: number;
	principalTax: number;
	shipping: number;
	shippingTax: number;
	otherTax: number;
	refund: number;
	netSalesWithTax: number;
	netSalesWithoutTax: number;
	costPrice: number;
	grossProfitWithTax: number;
	grossProfitWithoutTax: number;
	sga: number;
	amazonAds: number;
	promotion: number;
	salesCommission: number;
	fbaShippingFee: number;
	inventoryStorageFee: number;
	inventoryUpdateFee: number;
	shippingReturnFee: number;
	subscriptionFee: number;
	amazonOtherWithTax: number;
	amazonOtherWithoutTax: number;
	operatingProfitWithTax: number;
	operatingProfitWithoutTax: number;
	unpaidBalance: number;
	inventoryAssets: number;
	accruedConsumptionTax: number;
	outputConsumptionTax: number;
}; // withTaxとかネストさせた方がいいかも
