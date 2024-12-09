import { TrendingUp } from 'lucide-react';
import {
	CartesianGrid,
	Line,
	LineChart as LineChartIcon,
	XAxis,
} from 'recharts';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from './card';
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from './chart';

const chartData = [
	{ month: 'January', desktop: 186 },
	{ month: 'February', desktop: 305 },
	{ month: 'March', desktop: 237 },
	{ month: 'April', desktop: 73 },
	{ month: 'May', desktop: 209 },
	{ month: 'June', desktop: 214 },
];

const chartConfig = {
	desktop: {
		label: 'Desktop',
		color: 'hsl(var(--chart-1))',
	},
} satisfies ChartConfig;

export default function LineChart() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Line Chart - Linear</CardTitle>
				<CardDescription>January - June 2024</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<LineChartIcon
						accessibilityLayer
						data={chartData}
						margin={{
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey='month'
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={value => value.slice(0, 3)}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent hideLabel />}
						/>
						<Line
							dataKey='desktop'
							type='linear'
							stroke='var(--color-desktop)'
							strokeWidth={2}
							dot={false}
						/>
					</LineChartIcon>
				</ChartContainer>
			</CardContent>
			<CardFooter className='flex-col items-start gap-2 text-sm'>
				<div className='flex gap-2 font-medium leading-none'>
					Trending up by 5.2% this month <TrendingUp className='h-4 w-4' />
				</div>
				<div className='leading-none text-muted-foreground'>
					Showing total visitors for the last 6 months
				</div>
			</CardFooter>
		</Card>
	);
}
