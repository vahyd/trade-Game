import type { Country, CountryId, Commodity, CommodityId, TradeOrder, Shock } from './types';
import { ExportAgent, type ExportOpportunity } from './ExportAgent';
import { ImportAgent, type ImportNeed } from './ImportAgent';

export interface StrategicSuggestion {
  id: string;
  type: 'export' | 'import' | 'stockpile' | 'diversify' | 'currency' | 'contract';
  title: string;
  description: string;
  reasoning: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string; // what the player should click
  tradeOrder?: TradeOrder; // pre-filled order if player accepts
  commodityId?: CommodityId;
  partnerId?: CountryId;
  quantity?: number;
  price?: number;
}

export interface RoundBriefing {
  round: number;
  headline: string;
  summary: string;
  shocks: Shock[];
  currencyOutlook: string;
  exportOpportunities: ExportOpportunity[];
  importNeeds: ImportNeed[];
  suggestions: StrategicSuggestion[];
  criticalAlerts: string[];
}

export class TraderAdvisor {
  private exportAgent: ExportAgent;
  private importAgent: ImportAgent;

  constructor() {
    this.exportAgent = new ExportAgent();
    this.importAgent = new ImportAgent();
  }

  /**
   * Produce a full round briefing for the human player.
   * Merges export opportunities, import needs, and exchange rate
   * analysis into a conversational set of strategic suggestions.
   */
  generateBriefing(
    country: Country,
    allCountries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>,
    activeShocks: Shock[],
    round: number
  ): RoundBriefing {
    // Run both agents
    const exportOpps = this.exportAgent.evaluate(country, allCountries, commodities);
    const importNeeds = this.importAgent.evaluate(country, allCountries, commodities);

    // Currency outlook
    const currencyOutlook = this.analyzeCurrency(country, commodities);

    // Generate suggestions
    const suggestions: StrategicSuggestion[] = [];
    const criticalAlerts: string[] = [];

    // 1. Export suggestions
    for (const opp of exportOpps) {
      if (opp.priority === 'high' && opp.suggestedBuyers.length > 0) {
        const buyer = opp.suggestedBuyers[0];
        const quantity = Math.min(opp.surplus, Math.ceil(opp.surplus * 0.6));
        suggestions.push({
          id: `export-${opp.commodityId}`,
          type: 'export',
          title: `Export ${opp.commodityName} to ${buyer.name}`,
          description: `Sell ${quantity} units at ~${opp.globalPrice} GTU each.`,
          reasoning: opp.reasoning,
          priority: 'high',
          action: `Export ${quantity} ${opp.commodityName}`,
          tradeOrder: {
            id: `sug-export-${opp.commodityId}-${round}`,
            countryId: country.id,
            commodityId: opp.commodityId,
            type: 'sell',
            quantity,
            price: opp.globalPrice,
            currency: allCountries[buyer.countryId]?.currency ?? 'GTU',
            counterparty: buyer.countryId,
            contractType: 'spot',
          },
          commodityId: opp.commodityId,
          partnerId: buyer.countryId,
          quantity,
          price: opp.globalPrice,
        });
      }
    }

    // 2. Import suggestions
    for (const need of importNeeds) {
      if (need.urgency === 'critical' || need.urgency === 'high') {
        const bestSupplier = need.suggestedSuppliers[0];
        if (!bestSupplier) {
          criticalAlerts.push(`No supplier found for ${need.commodityName}! Stockpile exhausted.`);
          continue;
        }

        const quantity = Math.ceil(need.deficit * (need.urgency === 'critical' ? 1.0 : 0.6));

        suggestions.push({
          id: `import-${need.commodityId}`,
          type: 'import',
          title: `Import ${need.commodityName} from ${bestSupplier.name}`,
          description: `Buy ${quantity} units at ${bestSupplier.landedCost} GTU landed. ${bestSupplier.riskNote ?? ''}`,
          reasoning: need.reasoning,
          priority: need.urgency === 'critical' ? 'critical' : 'high',
          action: `Import ${quantity} ${need.commodityName}`,
          tradeOrder: {
            id: `sug-import-${need.commodityId}-${round}`,
            countryId: country.id,
            commodityId: need.commodityId,
            type: 'buy',
            quantity,
            price: bestSupplier.price,
            currency: bestSupplier.currency,
            counterparty: bestSupplier.countryId,
            contractType: 'spot',
          },
          commodityId: need.commodityId,
          partnerId: bestSupplier.countryId,
          quantity,
          price: bestSupplier.price,
        });

        // If only one supplier and risky, suggest diversification
        if (bestSupplier.risk === 'high' && need.suggestedSuppliers.length > 1) {
          const alt = need.suggestedSuppliers[1];
          suggestions.push({
            id: `diversify-${need.commodityId}`,
            type: 'diversify',
            title: `Diversify ${need.commodityName} supply`,
            description: `Split imports between ${bestSupplier.name} and ${alt.name} to reduce dependency risk.`,
            reasoning: `${Math.round((bestSupplier as any).riskNote ? 100 : 70)}% of your ${need.commodityName} comes from one source. A disruption could be devastating.`,
            priority: 'medium',
            action: 'Diversify suppliers',
            commodityId: need.commodityId,
          });
        }
      } else if (need.urgency === 'moderate') {
        const bestSupplier = need.suggestedSuppliers[0];
        if (bestSupplier && bestSupplier.landedCost < (commodities[need.commodityId]?.currentGlobalPrice ?? 999) * 0.9) {
          suggestions.push({
            id: `import-${need.commodityId}`,
            type: 'import',
            title: `Top up ${need.commodityName} at good price`,
            description: `${bestSupplier.name} offers ${need.commodityName} below market. Good time to stock up.`,
            reasoning: `Prices are favorable and you have ${need.inventoryCoverage} quarters of coverage.`,
            priority: 'medium',
            action: `Import ${Math.ceil(need.deficit * 0.4)} ${need.commodityName}`,
            commodityId: need.commodityId,
            partnerId: bestSupplier.countryId,
            quantity: Math.ceil(need.deficit * 0.4),
            price: bestSupplier.price,
          });
        }
      }
    }

    // 3. Currency action suggestions
    if (country.currencyValue > 8 && country.inflation > 8) {
      suggestions.push({
        id: 'currency-defend',
        type: 'currency',
        title: 'Defend your currency',
        description: `Your ${country.currency} is under severe pressure. Cut non-essential imports and boost exports.`,
        reasoning: `Depreciation of ${country.currency} is driving inflation (${country.inflation.toFixed(1)}%). Each round of weakness makes imports more expensive.`,
        priority: 'critical',
        action: 'Review import needs',
      });
    } else if (country.tradeBalance < -50) {
      suggestions.push({
        id: 'currency-tradegap',
        type: 'currency',
        title: 'Narrow the trade gap',
        description: `Your trade deficit is draining FX reserves. Export more or import less.`,
        reasoning: `Trade deficit of ${Math.abs(country.tradeBalance).toFixed(0)} GTU. FX reserves: ${country.fxReserves.toFixed(0)} GTU.`,
        priority: 'high',
        action: 'Boost exports',
      });
    }

    // 4. Stockpile suggestion for security-first or during crisis
    if (activeShocks.length > 0 && country.aiPersonality !== 'security-first') {
      const criticalImport = importNeeds.find(n => n.urgency === 'critical' || n.urgency === 'high');
      if (criticalImport) {
        suggestions.push({
          id: 'stockpile-warning',
          type: 'stockpile',
          title: `Secure ${criticalImport.commodityName} supply`,
          description: 'Lock in a fixed-price contract to protect against further disruption.',
          reasoning: `Active shocks threaten supply chains. A fixed contract locks today\'s price for the next 2-3 quarters.`,
          priority: 'medium',
          action: 'Create fixed contract',
          commodityId: criticalImport.commodityId,
          partnerId: criticalImport.suggestedSuppliers[0]?.countryId,
        });
      }
    }

    // Sort suggestions by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Build headline
    let headline: string;
    if (activeShocks.length > 0) {
      headline = `⚠ Quarter ${round} — ${activeShocks.map(s => s.name).join(' & ')}`;
    } else if (exportOpps.some(o => o.priority === 'high')) {
      headline = `📈 Quarter ${round} — Strong export opportunities`;
    } else {
      headline = `📊 Quarter ${round} — Market Report`;
    }

    // Summary
    const summaryParts: string[] = [];
    const highExports = exportOpps.filter(o => o.priority === 'high');
    const criticalImports = importNeeds.filter(n => n.urgency === 'critical');
    if (highExports.length > 0) summaryParts.push(`${highExports.length} strong export opportunity`);
    if (criticalImports.length > 0) summaryParts.push(`${criticalImports.length} critical import need`);
    if (activeShocks.length > 0) summaryParts.push(`${activeShocks.length} active shock(s)`);
    const summary = summaryParts.length > 0 ? summaryParts.join(', ') + '.' : 'Markets are stable.';

    return {
      round,
      headline,
      summary,
      shocks: activeShocks,
      currencyOutlook,
      exportOpportunities: exportOpps,
      importNeeds,
      suggestions,
      criticalAlerts,
    };
  }

  private analyzeCurrency(country: Country, commodities: Record<CommodityId, Commodity>): string {
    const parts: string[] = [];
    parts.push(`1 GTU = ${country.currencyValue} ${country.currency}`);

    if (country.inflation > 10) {
      parts.push(`Inflation is dangerously high at ${country.inflation.toFixed(1)}%.`);
    } else if (country.inflation > 5) {
      parts.push(`Inflation is elevated at ${country.inflation.toFixed(1)}%.`);
    } else {
      parts.push(`Inflation is stable at ${country.inflation.toFixed(1)}%.`);
    }

    if (country.tradeBalance > 0) {
      parts.push(`Trade surplus of ${country.tradeBalance.toFixed(0)} GTU supports the ${country.currency}.`);
    } else if (country.tradeBalance < -30) {
      parts.push(`Trade deficit of ${Math.abs(country.tradeBalance).toFixed(0)} GTU is putting downward pressure on the ${country.currency}.`);
    }

    if (country.fxReserves < 200) {
      parts.push(`⚠ FX reserves critically low at ${country.fxReserves.toFixed(0)} GTU.`);
    }

    return parts.join(' ');
  }
}
