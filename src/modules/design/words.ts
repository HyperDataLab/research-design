const words: Record<string, Record<string, string>> = {
  family: {
    experimental: 'Thực nghiệm',
    quasi_experimental: 'Bán thực nghiệm',
    observational: 'Quan sát',
    descriptive: 'Mô tả',
  },
  causalLicence: {
    causal: 'Nhân quả',
    conditional: 'Nhân quả có điều kiện',
    none: 'Không cho phép kết luận nhân quả',
    associational: 'Liên hệ',
  },
  assignment: {
    random: 'Ngẫu nhiên',
    non_random: 'Không ngẫu nhiên',
    none: 'Không phân nhóm',
    either: 'Người nghiên cứu chọn',
  },
  validity: {
    internal: 'Giá trị nội tại',
    external: 'Giá trị ngoại tại',
    construct: 'Giá trị cấu trúc',
    statistical: 'Giá trị thống kê',
  },
};
export const word = (kind: string, value: string) => words[kind]?.[value] ?? value;
export const assignments = ['random', 'non_random', 'none'].map((value) => ({
  value,
  label: word('assignment', value),
}));
