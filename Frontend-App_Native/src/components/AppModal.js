import React from "react";
import { Modal } from "react-native";
import { ToastHost } from "../contexts/ToastContext";

/**
 * Thay thế cho <Modal> của React Native trong mọi popup của app.
 *
 * Việc duy nhất nó làm thêm: render <ToastHost /> bên trong cửa sổ modal.
 *
 * Lý do: <Modal> của RN là một cửa sổ native riêng, nằm trên toàn bộ cây View.
 * Toast render ở gốc app sẽ bị cửa sổ này che hoàn toàn — bấm Lưu xong không
 * thấy báo gì. Đưa toast vào trong chính cửa sổ đó thì nó hiện lên trên popup,
 * mà vẫn không chặn thao tác vì ToastHost dùng pointerEvents="none".
 *
 * Mọi prop khác chuyển thẳng xuống <Modal>, nên đây là drop-in replacement:
 * chỉ cần đổi tên thẻ, không phải sửa gì thêm.
 */
export default function AppModal({ children, ...props }) {
  return (
    <Modal {...props}>
      {children}
      <ToastHost />
    </Modal>
  );
}
