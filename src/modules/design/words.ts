const words: Record<string, Record<string, string>> = {
  family: {
    experimental: 'Thực nghiệm',
    quasi_experimental: 'Bán thực nghiệm',
    observational: 'Quan sát',
    computational: 'Tính toán',
    qualitative: 'Định tính',
    mixed: 'Hỗn hợp',
    design_science: 'Khoa học thiết kế',
    synthesis: 'Tổng hợp',
    replication: 'Lặp lại',
    formal: 'Hình thức',
    descriptive: 'Mô tả',
  },
  causalLicence: {
    causal: 'Nhân quả',
    causal_under_stated_assumptions: 'Nhân quả theo các giả định đã nêu',
    descriptive: 'Mô tả',
    existence_proof: 'Chứng minh sự tồn tại',
    deductive: 'Suy diễn',
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
    statistical_conclusion: 'Giá trị kết luận thống kê',
    credibility: 'Độ tin cậy',
    transferability: 'Khả năng chuyển giao',
    dependability: 'Tính nhất quán',
    confirmability: 'Khả năng xác nhận',
    statistical: 'Giá trị thống kê',
  },
};
export const word = (kind: string, value: string) => words[kind]?.[value] ?? value;
export const assignments = ['random', 'non_random', 'none'].map((value) => ({
  value,
  label: word('assignment', value),
}));
