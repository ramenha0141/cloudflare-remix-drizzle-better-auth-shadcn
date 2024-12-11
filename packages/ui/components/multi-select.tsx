import { Button } from '@seller-kanrikun/ui/components/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@seller-kanrikun/ui/components/dropdown-menu';
interface ISelectProps {
	values: {
		key: string;
		value: string;
	}[];
}

interface MultiSelectProps {
	values: Record<string, string>;
	selects: string[];
	onSelectChange: (value: string[]) => void;
}

export default function MultiSelect({
	values,
	selects,
	onSelectChange,
}: MultiSelectProps) {
	const handleSelectChange = (value: string) => {
		const result = [...selects];
		if (!result.includes(value)) {
			result.push(value);
		} else {
			const indexOfItemToBeRemoved = result.indexOf(value);
			result.splice(indexOfItemToBeRemoved, 1);
		}

		onSelectChange(result);
	};

	const isOptionSelected = (value: string): boolean => {
		return selects.includes(value);
	};
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='outline' className='flex gap-2 font-bold'>
					{selects.length === 0 ? (
						<span>Select Values</span>
					) : (
						<span>
							{selects.length} item{selects.length === 1 ? '' : 's'} selected
						</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className='w-56'
				onCloseAutoFocus={e => e.preventDefault()}
			>
				<DropdownMenuLabel>Appearance</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{Object.entries(values).map(([key, value], index) => {
					return (
						<DropdownMenuCheckboxItem
							onSelect={e => e.preventDefault()}
							key={index.toString()}
							checked={isOptionSelected(key)}
							onCheckedChange={() => handleSelectChange(key)}
						>
							{value}
						</DropdownMenuCheckboxItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}