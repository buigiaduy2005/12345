import React from 'react';
import { Input, Button, Avatar, Space, Badge } from 'antd';
import { 
    SearchOutlined, ShareAltOutlined, BellOutlined, 
    UserAddOutlined, MoreOutlined, RightOutlined
} from '@ant-design/icons';
import styles from './SynchroHeader.module.css';

interface SynchroHeaderProps {
    breadcrumb: { label: string; active?: boolean }[];
    members?: any[];
}

export default function SynchroHeader({ breadcrumb, members = [] }: SynchroHeaderProps) {
    return (
        <header className={styles.header}>
            <div className={styles.breadcrumbWrapper}>
                {breadcrumb.map((item, index) => (
                    <React.Fragment key={index}>
                        <div className={`${styles.breadcrumbItem} ${item.active ? styles.active : ''}`}>
                            {item.label}
                        </div>
                        {index < breadcrumb.length - 1 && (
                            <RightOutlined className={styles.separator} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            <div className={styles.headerRight}>
                <div className={styles.searchWrapper}>
                    <SearchOutlined className={styles.searchIcon} />
                    <input type="text" placeholder="Search projects..." className={styles.searchInput} />
                </div>

                <Space size={12} className={styles.actions}>
                    <Button type="text" icon={<ShareAltOutlined />} className={styles.actionBtn} />
                    <Badge count={0} dot offset={[-4, 4]}>
                        <Button type="text" icon={<BellOutlined />} className={styles.actionBtn} />
                    </Badge>
                </Space>

                <div className={styles.divider} />

                <Space size={16} className={styles.membersSection}>
                    <Avatar.Group maxCount={3} size={32} className={styles.avatarGroup}>
                        <Avatar src="https://i.pravatar.cc/150?u=1" />
                        <Avatar src="https://i.pravatar.cc/150?u=2" />
                        <Avatar src="https://i.pravatar.cc/150?u=3" />
                        <Avatar src="https://i.pravatar.cc/150?u=4" />
                        <Avatar src="https://i.pravatar.cc/150?u=5" />
                    </Avatar.Group>
                    
                    <Button type="primary" icon={<UserAddOutlined />} className={styles.inviteBtn}>
                        Invite
                    </Button>
                    
                    <Button type="text" icon={<MoreOutlined />} className={styles.actionBtn} />
                </Space>
            </div>
        </header>
    );
}
